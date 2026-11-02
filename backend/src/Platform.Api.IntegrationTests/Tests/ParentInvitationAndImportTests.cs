using System.IO.Compression;
using System.Net;
using System.Net.Http.Json;
using System.Security;
using System.Text;
using System.Text.Json.Nodes;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Platform.Api.Email;
using Platform.Api.IntegrationTests.Fixtures;
using Platform.Infrastructure;
using Xunit;

namespace Platform.Api.IntegrationTests.Tests;

/// <summary>
/// Parent Progress Reports BA §6: parents typed into an invitation wait with it and are only
/// emailed once the student accepts; a cancelled or expired invitation creates no contacts.
/// Spreadsheets (.csv and .xlsx) feed the same invitations, and "Import parents" for existing
/// students previews first, saves nothing until confirmed, and never duplicates on a re-import.
/// </summary>
public class ParentInvitationAndImportTests(PlatformApiTestFixture fixture) : ParentReportsTestBase(fixture), IClassFixture<PlatformApiTestFixture>
{
    private const string Header = "student_email,parent1_name,parent1_email,parent1_whatsapp,parent1_language,parent2_name,parent2_email,parent2_whatsapp,parent2_language";

    [Fact]
    public async Task Parents_Are_Emailed_Only_When_The_Student_Accepts_And_Never_For_A_Cancelled_Or_Expired_Invitation()
    {
        var c = await SeedCourseAsync("pr-inv");
        var invites = $"/api/workspaces/{c.Slug}/invitations";

        var accepted = await Tutor(c, HttpMethod.Post, invites, new
        {
            email = "kid1@students.test", role = "Learner",
            parents = new[] { new { name = "Hala", email = "p1@parents.test", language = "ar" }, new { name = "Omar", email = "p2@parents.test", language = "en" } },
        });
        var cancelled = await Tutor(c, HttpMethod.Post, invites, new
        {
            email = "kid2@students.test", role = "Learner", parents = new[] { new { name = "Mona", email = "p3@parents.test", language = "ar" } },
        });
        var expired = await Tutor(c, HttpMethod.Post, invites, new
        {
            email = "kid3@students.test", role = "Learner", parents = new[] { new { name = "Sami", email = "p4@parents.test", language = "ar" } },
        });

        // Nothing goes to a parent at invite time; the pending list shows how many are attached.
        Assert.DoesNotContain(Mail.Sent, e => e.ToAddress.EndsWith("@parents.test"));
        var rows = (await Tutor(c, HttpMethod.Get, $"/api/workspaces/{c.Slug}/members"))["invitations"]!.AsArray();
        Assert.Equal(2, rows.First(i => i!["email"]!.GetValue<string>() == "kid1@students.test")!["parentCount"]!.GetValue<int>());

        // Teachers can't be invited with parents.
        Assert.Equal(HttpStatusCode.BadRequest, (await TutorRaw(c, HttpMethod.Post, invites, new
        {
            email = "teacher@staff.test", role = "Teacher", parents = new[] { new { name = "X", email = "x@parents.test" } },
        })).StatusCode);

        // Cancel one, let another lapse.
        await Tutor(c, HttpMethod.Post, $"{invites}/{cancelled["invitationId"]!.GetValue<Guid>()}/cancel");
        var expiredId = expired["invitationId"]!.GetValue<Guid>();
        await WithServiceAsync(sp => sp.GetRequiredService<PlatformDbContext>().Database.ExecuteSqlInterpolatedAsync(
            $"UPDATE invitations SET \"ExpiresAt\" = now() - interval '1 day' WHERE \"Id\" = {expiredId}"));

        await AcceptAsync(c, accepted["invitationLink"]!.GetValue<string>(), "Kid One");
        Assert.Equal(HttpStatusCode.Conflict, (await AcceptRawAsync(c, expired["invitationLink"]!.GetValue<string>(), "Kid Three")).StatusCode);

        // The accepted student's parents are now contacts, each with one confirmation email.
        var contacts = (await Tutor(c, HttpMethod.Get, $"/api/workspaces/{c.Slug}/parent-contacts"))["contacts"]!.AsArray();
        Assert.Equal(["p1@parents.test", "p2@parents.test"], contacts.Select(p => p!["email"]!.GetValue<string>()).Order().ToArray());
        Assert.All(contacts, p => Assert.Equal("Waiting", p!["status"]!.GetValue<string>()));
        Assert.Equal(EmailTemplate.ParentConfirmation, Assert.Single(Mail.To("p1@parents.test")).Template);
        Assert.Contains("dir=\"rtl\"", Mail.To("p1@parents.test")[0].Content.Html); // Hala chose Arabic
        Assert.Contains("dir=\"ltr\"", Mail.To("p2@parents.test")[0].Content.Html);

        // Cancelled and expired: no contacts, no email, and the cancelled one's details are gone.
        Assert.Empty(Mail.To("p3@parents.test"));
        Assert.Empty(Mail.To("p4@parents.test"));
        var stored = await WithServiceAsync(sp => sp.GetRequiredService<PlatformDbContext>().InvitationParentContacts
            .CountAsync(p => p.InvitationId == cancelled["invitationId"]!.GetValue<Guid>()));
        Assert.Equal(0, stored);
    }

    [Theory]
    [InlineData("csv")]
    [InlineData("xlsx")]
    public async Task A_Spreadsheet_Bulk_Invite_Creates_The_Parents_After_Each_Student_Accepts(string format)
    {
        var c = await SeedCourseAsync($"pr-bulk-{format}");
        string[][] data =
        [
            [$"a-{format}@students.test", "Hala", $"hala-{format}@parents.test", "+20 100 123 4567", "Arabic", "Omar", $"omar-{format}@parents.test", "", "en"],
            [$"b-{format}@students.test", "Mona", $"mona-{format}@parents.test", "", "", "", "", "", ""],
            [$"c-{format}@students.test", "", "", "", "", "", "", "", ""],
        ];
        var file = format == "csv" ? Csv(data) : Xlsx(data);

        var preview = await PreviewAsync(c, "invite", file, $"students.{format}");
        Assert.Null(preview["fileProblem"]);
        var previewRows = preview["rows"]!.AsArray();
        Assert.Equal(3, previewRows.Count);
        Assert.All(previewRows, r => Assert.Empty(r!["problems"]!.AsArray()));
        Assert.Equal("+201001234567", previewRows[0]!["parents"]![0]!["whatsAppPhone"]!.GetValue<string>());

        var result = await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/invitations/bulk", new
        {
            role = "Learner", source = "CsvImport",
            recipients = previewRows.Select(r => new { email = r!["studentEmail"]!.GetValue<string>(), parents = r["parents"] }).ToArray(),
        });
        var issued = result["results"]!.AsArray();
        Assert.Equal(3, issued.Count(r => r!["outcome"]!.GetValue<string>() == "issued"));
        Assert.DoesNotContain(Mail.Sent, e => e.ToAddress.EndsWith("@parents.test"));

        foreach (var r in issued)
            await AcceptAsync(c, r!["invitationLink"]!.GetValue<string>(), "A Student");

        var contacts = (await Tutor(c, HttpMethod.Get, $"/api/workspaces/{c.Slug}/parent-contacts"))["contacts"]!.AsArray();
        Assert.Equal(3, contacts.Count);
        var hala = contacts.First(p => p!["email"]!.GetValue<string>() == $"hala-{format}@parents.test")!;
        Assert.Equal("ar", hala["language"]!.GetValue<string>());
        Assert.Equal("+201001234567", hala["whatsAppPhone"]!.GetValue<string>());
        Assert.Single(Mail.To($"mona-{format}@parents.test", EmailTemplate.ParentConfirmation));
    }

    [Fact]
    public async Task Import_For_Existing_Students_Previews_Problems_Saves_Nothing_Until_Confirmed_And_Never_Duplicates()
    {
        var c = await SeedCourseAsync("pr-import");
        await EnrollLearnerAsync(c, "pr-import-full");
        var fullId = await LearnerMembershipIdAsync(c, "pr-import-full@integrationtest.local");
        await AddParentAsync(c, fullId, "Already here", "already@parents.test");
        var before = await ContactCountAsync();

        var file = Csv(
        [
            [LearnerEmail("pr-import"), "Hala", "hala-imp@parents.test", "", "ar", "Omar", "omar-imp@parents.test", "", "en"],
            ["nobody@students.test", "Mona", "mona-imp@parents.test", "", "", "", "", "", ""],
            [LearnerEmail("pr-import"), "Bad", "not-an-email", "", "", "", "", "", ""],
            ["pr-import-full@integrationtest.local", "One", "one-imp@parents.test", "", "", "Two", "two-imp@parents.test", "", ""],
        ]);

        var preview = await PreviewAsync(c, "existing", file, "parents.csv");
        var rows = preview["rows"]!.AsArray();
        string[] Problems(int i) => rows[i]!["problems"]!.AsArray().Select(p => p!.GetValue<string>()).ToArray();
        Assert.Empty(Problems(0));
        Assert.Contains("studentNotFound", Problems(1));
        Assert.Contains("parentEmailInvalid", Problems(2));
        Assert.Contains("duplicateStudent", Problems(2));
        Assert.Contains("tooManyParents", Problems(3));
        Assert.Equal(before, await ContactCountAsync()); // a preview saves nothing
        Assert.DoesNotContain(Mail.Sent, e => e.ToAddress.EndsWith("-imp@parents.test"));

        // The tutor confirms only the OK row — twice.
        var keep = new { rows = new[] { new { studentEmail = rows[0]!["studentEmail"]!.GetValue<string>(), parents = rows[0]!["parents"] } } };
        var first = await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/parent-contacts/import", keep);
        Assert.Equal(2, first["created"]!.GetValue<int>());
        var second = await Tutor(c, HttpMethod.Post, $"/api/workspaces/{c.Slug}/parent-contacts/import", keep);
        Assert.Equal(0, second["created"]!.GetValue<int>());
        Assert.Equal(2, second["updated"]!.GetValue<int>());
        Assert.Equal(before + 2, await ContactCountAsync());
        Assert.Single(Mail.To("hala-imp@parents.test", EmailTemplate.ParentConfirmation)); // confirmation sent once
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private Task<int> ContactCountAsync() =>
        WithServiceAsync(sp => sp.GetRequiredService<PlatformDbContext>().ParentContacts.CountAsync(p => p.Status != Platform.Domain.ParentContactStatus.Removed));

    private static async Task<JsonObject> PreviewAsync(Course c, string mode, byte[] file, string fileName)
    {
        using var form = new MultipartFormDataContent { { new ByteArrayContent(file), "file", fileName } };
        using var req = new HttpRequestMessage(HttpMethod.Post, $"/api/workspaces/{c.Slug}/parent-contacts/import/preview?mode={mode}") { Content = form };
        req.Headers.Authorization = new("Bearer", c.TutorToken);
        var res = await c.Client.SendAsync(req);
        var text = await res.Content.ReadAsStringAsync();
        Assert.True(res.IsSuccessStatusCode, $"preview → {(int)res.StatusCode}: {text}");
        return JsonNode.Parse(text)!.AsObject();
    }

    private static Task<HttpResponseMessage> AcceptRawAsync(Course c, string link, string fullName) =>
        c.Client.PostAsJsonAsync($"/api/invitations/{link.Split('/').Last()}/accept", new { fullName, password = "Learner-Secure!2026" });

    private static async Task AcceptAsync(Course c, string link, string fullName)
    {
        var res = await AcceptRawAsync(c, link, fullName);
        Assert.True(res.IsSuccessStatusCode, $"accept → {(int)res.StatusCode}: {await res.Content.ReadAsStringAsync()}");
    }

    private static byte[] Csv(string[][] rows)
    {
        var sb = new StringBuilder("﻿" + Header + "\r\n"); // with a BOM, as Excel saves it
        foreach (var r in rows) sb.Append(string.Join(',', r.Select(v => v.Contains(',') ? $"\"{v}\"" : v))).Append("\r\n");
        return Encoding.UTF8.GetBytes(sb.ToString());
    }

    /// <summary>A minimal real .xlsx: one sheet, inline strings, the header in shared strings (both cell kinds Excel writes).</summary>
    private static byte[] Xlsx(string[][] rows)
    {
        var header = Header.Split(',');
        static string Col(int i) => ((char)('A' + i)).ToString();
        var sheet = new StringBuilder("""<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>""");
        sheet.Append("<row r=\"1\">");
        for (var i = 0; i < header.Length; i++) sheet.Append($"<c r=\"{Col(i)}1\" t=\"s\"><v>{i}</v></c>");
        sheet.Append("</row>");
        for (var r = 0; r < rows.Length; r++)
        {
            sheet.Append($"<row r=\"{r + 2}\">");
            for (var i = 0; i < rows[r].Length; i++)
                if (rows[r][i].Length > 0)
                    sheet.Append($"<c r=\"{Col(i)}{r + 2}\" t=\"inlineStr\"><is><t>{SecurityElement.Escape(rows[r][i])}</t></is></c>");
            sheet.Append("</row>");
        }
        sheet.Append("</sheetData></worksheet>");
        var shared = "<?xml version=\"1.0\" encoding=\"UTF-8\"?><sst xmlns=\"http://schemas.openxmlformats.org/spreadsheetml/2006/main\">"
            + string.Concat(header.Select(h => $"<si><t>{h}</t></si>")) + "</sst>";

        using var ms = new MemoryStream();
        using (var zip = new ZipArchive(ms, ZipArchiveMode.Create, leaveOpen: true))
        {
            void Add(string path, string xml) { using var w = new StreamWriter(zip.CreateEntry(path).Open(), new UTF8Encoding(false)); w.Write(xml); }
            Add("[Content_Types].xml", """<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>""");
            Add("xl/workbook.xml", """<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Students" sheetId="1" r:id="rId1"/></sheets></workbook>""");
            Add("xl/_rels/workbook.xml.rels", """<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>""");
            Add("xl/worksheets/sheet1.xml", sheet.ToString());
            Add("xl/sharedStrings.xml", shared);
        }
        return ms.ToArray();
    }
}
