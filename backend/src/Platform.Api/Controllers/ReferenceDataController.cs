using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Platform.Api.Models;
using Platform.Api.Services;

namespace Platform.Api.Controllers;

/// <summary>
/// Static lookup data the frontend renders from instead of hard-coding
/// domain enum members and their display text.
/// </summary>
[ApiController]
[Route("api/reference")]
[Authorize]
public class ReferenceDataController : ControllerBase
{
    [HttpGet("question-types")]
    public ActionResult<IReadOnlyList<QuestionTypeOption>> QuestionTypes() => Ok(QuestionTypeCatalog.All);
}
