using System.Globalization;
using System.IO.Compression;
using System.Text;
using System.Xml;
using System.Xml.Linq;

namespace Platform.Api.Services;

/// <summary>
/// Reads the first sheet of an uploaded .csv or .xlsx into rows of trimmed cell text. Deliberately
/// small, with no package dependency: the parent import needs plain text cells from one sheet, not
/// formulas, styles or dates. Anything it can't read is reported as <see cref="SpreadsheetException"/>.
/// </summary>
public static class SpreadsheetReader
{
    public const long MaxBytes = 1024 * 1024;
    public const int MaxRows = 501; // a header plus 500 rows

    public static List<string[]> Read(Stream content, string fileName)
    {
        using var buffer = new MemoryStream();
        content.CopyTo(buffer);
        if (buffer.Length > MaxBytes) throw new SpreadsheetException("fileTooLarge");
        var bytes = buffer.ToArray();

        // .xlsx is a ZIP ("PK"); anything else is treated as CSV text.
        var isZip = bytes.Length > 1 && bytes[0] == (byte)'P' && bytes[1] == (byte)'K';
        if (fileName.EndsWith(".xlsx", StringComparison.OrdinalIgnoreCase) || isZip)
            return isZip ? ReadXlsx(bytes) : throw new SpreadsheetException("unreadableFile");
        if (fileName.EndsWith(".xls", StringComparison.OrdinalIgnoreCase))
            throw new SpreadsheetException("unreadableFile"); // the old binary format — save as .xlsx or .csv
        return ReadCsv(DecodeText(bytes));
    }

    // ── CSV ───────────────────────────────────────────────────────────────────

    private static string DecodeText(byte[] bytes)
    {
        if (bytes.Contains((byte)0)) throw new SpreadsheetException("unreadableFile");
        var text = new UTF8Encoding(false, throwOnInvalidBytes: false).GetString(bytes);
        return text.TrimStart('﻿');
    }

    /// <summary>RFC 4180 quoting; comma, or semicolon when the header row has no comma (Excel in some locales).</summary>
    public static List<string[]> ReadCsv(string text)
    {
        var firstLine = text.Split('\n', 2)[0];
        var delimiter = !firstLine.Contains(',') && firstLine.Contains(';') ? ';' : ',';

        var rows = new List<string[]>();
        var row = new List<string>();
        var cell = new StringBuilder();
        var inQuotes = false;

        for (var i = 0; i < text.Length; i++)
        {
            var c = text[i];
            if (inQuotes)
            {
                if (c == '"' && i + 1 < text.Length && text[i + 1] == '"') { cell.Append('"'); i++; }
                else if (c == '"') inQuotes = false;
                else cell.Append(c);
                continue;
            }
            if (c == '"') inQuotes = true;
            else if (c == delimiter) { row.Add(cell.ToString().Trim()); cell.Clear(); }
            else if (c is '\n' or '\r')
            {
                if (c == '\r' && i + 1 < text.Length && text[i + 1] == '\n') i++;
                row.Add(cell.ToString().Trim()); cell.Clear();
                AddRow(rows, row);
                row = [];
            }
            else cell.Append(c);
        }
        if (cell.Length > 0 || row.Count > 0) { row.Add(cell.ToString().Trim()); AddRow(rows, row); }
        return rows;
    }

    private static void AddRow(List<string[]> rows, List<string> row)
    {
        if (row.All(string.IsNullOrWhiteSpace)) return;
        if (rows.Count >= MaxRows) throw new SpreadsheetException("tooManyRows");
        rows.Add(row.ToArray());
    }

    // ── XLSX (Office Open XML) ───────────────────────────────────────────────

    private static readonly XNamespace Main = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
    private static readonly XNamespace Rel = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
    private static readonly XNamespace PackageRel = "http://schemas.openxmlformats.org/package/2006/relationships";

    private static List<string[]> ReadXlsx(byte[] bytes)
    {
        try
        {
            using var zip = new ZipArchive(new MemoryStream(bytes), ZipArchiveMode.Read);
            var sharedStrings = LoadSharedStrings(zip);
            var sheet = Load(zip, FirstSheetPath(zip)) ?? throw new SpreadsheetException("unreadableFile");

            var rows = new List<string[]>();
            foreach (var rowElement in sheet.Descendants(Main + "row"))
            {
                var cells = new SortedDictionary<int, string>();
                var nextIndex = 0;
                foreach (var c in rowElement.Elements(Main + "c"))
                {
                    var index = ColumnIndex((string?)c.Attribute("r")) ?? nextIndex;
                    nextIndex = index + 1;
                    cells[index] = CellText(c, sharedStrings).Trim();
                }
                if (cells.Count == 0) continue;
                var values = new string[cells.Keys.Max() + 1];
                for (var i = 0; i < values.Length; i++) values[i] = cells.GetValueOrDefault(i, "");
                AddRow(rows, values.ToList());
            }
            return rows;
        }
        catch (SpreadsheetException) { throw; }
        catch (Exception ex) when (ex is InvalidDataException or XmlException or IOException or InvalidOperationException)
        {
            throw new SpreadsheetException("unreadableFile");
        }
    }

    private static string FirstSheetPath(ZipArchive zip)
    {
        var workbook = Load(zip, "xl/workbook.xml") ?? throw new SpreadsheetException("unreadableFile");
        var relId = (string?)workbook.Descendants(Main + "sheet").FirstOrDefault()?.Attribute(Rel + "id");
        var rels = Load(zip, "xl/_rels/workbook.xml.rels");
        var target = (string?)rels?.Descendants(PackageRel + "Relationship")
            .FirstOrDefault(r => (string?)r.Attribute("Id") == relId)?.Attribute("Target");
        if (string.IsNullOrEmpty(target)) return "xl/worksheets/sheet1.xml";
        return target.StartsWith('/') ? target.TrimStart('/') : "xl/" + target;
    }

    private static List<string> LoadSharedStrings(ZipArchive zip) =>
        Load(zip, "xl/sharedStrings.xml")?.Root?.Elements(Main + "si")
            .Select(si => string.Concat(si.Descendants(Main + "t").Select(t => t.Value)))
            .ToList() ?? [];

    private static string CellText(XElement c, List<string> shared)
    {
        var type = (string?)c.Attribute("t");
        if (type == "inlineStr") return string.Concat(c.Descendants(Main + "t").Select(t => t.Value));
        var v = c.Element(Main + "v")?.Value ?? "";
        if (type == "s") return int.TryParse(v, out var i) && i >= 0 && i < shared.Count ? shared[i] : "";
        if (type is "str" or "b" or "e") return v;
        // A number: a phone typed into Excel arrives as 201001234567 or 2.01001234567E+11.
        return decimal.TryParse(v, NumberStyles.Float, CultureInfo.InvariantCulture, out var n)
            ? n.ToString("0.##########", CultureInfo.InvariantCulture)
            : v;
    }

    /// <summary>"C7" → 2.</summary>
    private static int? ColumnIndex(string? reference)
    {
        if (string.IsNullOrEmpty(reference)) return null;
        var index = 0;
        var letters = 0;
        foreach (var ch in reference)
        {
            if (!char.IsAsciiLetter(ch)) break;
            index = index * 26 + (char.ToUpperInvariant(ch) - 'A' + 1);
            letters++;
        }
        return letters == 0 ? null : index - 1;
    }

    private static XDocument? Load(ZipArchive zip, string path)
    {
        var entry = zip.GetEntry(path);
        if (entry is null) return null;
        if (entry.Length > 20 * MaxBytes) throw new SpreadsheetException("fileTooLarge"); // a zip bomb guard
        using var stream = entry.Open();
        var settings = new XmlReaderSettings { DtdProcessing = DtdProcessing.Prohibit, XmlResolver = null };
        using var reader = XmlReader.Create(stream, settings);
        return XDocument.Load(reader);
    }
}

/// <summary>A file the import can't read; <see cref="Exception.Message"/> is the code the UI translates.</summary>
public class SpreadsheetException(string code) : Exception(code);
