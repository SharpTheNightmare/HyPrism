using HyPrism.Models;
using HyPrism.Services.Core.Infrastructure;

namespace HyPrism.Services.User;

/// <summary>
/// Provides helpers for migrating legacy profile folder structures to the current
/// ID-based layout. Called once per session by <see cref="ProfileManagementService"/>.
/// </summary>
public static class ProfileMigrationService
{
    /// <summary>
    /// Scans the profiles root directory for folders whose names do not match a GUID
    /// and attempts to match them to existing <paramref name="profiles"/> by name,
    /// then by embedded metadata, moving them to their correct ID-based location.
    /// </summary>
    /// <param name="profilesDir">The profiles root directory to scan.</param>
    /// <param name="profiles">The list of registered profiles.</param>
    /// <param name="appDir">The application data root directory.</param>
    public static void MigrateUnresolvedFolders(string profilesDir, List<Profile> profiles, string appDir)
    {
        if (!Directory.Exists(profilesDir))
            return;

        foreach (var folder in Directory.GetDirectories(profilesDir))
        {
            var folderName = Path.GetFileName(folder);
            if (Guid.TryParse(folderName, out _))
                continue;

            var matchedByName = profiles.FirstOrDefault(p =>
                string.Equals(UtilityService.SanitizeFileName(p.Name ?? string.Empty), folderName, StringComparison.OrdinalIgnoreCase));

            if (matchedByName != null)
            {
                var target = UtilityService.GetProfileFolderPath(appDir, matchedByName, createIfMissing: true, migrateLegacyByName: false);
                UtilityService.TryMigrateSpecificProfileFolder(folder, target);
                continue;
            }

            var matchedByMetadata = TryMatchByFolderMetadata(folder, profiles);
            if (matchedByMetadata != null)
            {
                var target = UtilityService.GetProfileFolderPath(appDir, matchedByMetadata, createIfMissing: true, migrateLegacyByName: false);
                UtilityService.TryMigrateSpecificProfileFolder(folder, target);
                continue;
            }

            Logger.Info("Profile", $"Found unknown profile folder, migration skipped: {folder}");
        }
    }

    /// <summary>
    /// Tries to identify the profile that owns a legacy folder by reading
    /// embedded metadata from <c>profile.json</c> or the first <c>*.sh</c> launch script.
    /// </summary>
    /// <param name="folder">The legacy folder path to inspect.</param>
    /// <param name="profiles">The list of registered profiles to search.</param>
    /// <returns>The matching profile, or <c>null</c> if no match is found.</returns>
    public static Profile? TryMatchByFolderMetadata(string folder, List<Profile> profiles)
    {
        try
        {
            var profileJsonPath = Path.Combine(folder, "profile.json");
            if (File.Exists(profileJsonPath))
            {
                var json = File.ReadAllText(profileJsonPath);
                using var doc = System.Text.Json.JsonDocument.Parse(json);
                var root = doc.RootElement;

                if (root.TryGetProperty("uuid", out var uuidEl))
                {
                    var uuid = uuidEl.GetString();
                    if (!string.IsNullOrWhiteSpace(uuid))
                    {
                        var byUuid = profiles.FirstOrDefault(p => string.Equals(p.UUID, uuid, StringComparison.OrdinalIgnoreCase));
                        if (byUuid != null)
                            return byUuid;
                    }
                }
            }

            var shFile = Directory.GetFiles(folder, "*.sh").FirstOrDefault();
            if (!string.IsNullOrWhiteSpace(shFile))
            {
                var lines = File.ReadAllLines(shFile);
                string? profileId = null;
                string? uuid = null;

                foreach (var line in lines)
                {
                    if (line.Contains("HYPRISM_PROFILE_ID=", StringComparison.Ordinal))
                        profileId = ExtractQuotedValue(line);
                    else if (line.Contains("HYPRISM_PROFILE_UUID=", StringComparison.Ordinal))
                        uuid = ExtractQuotedValue(line);
                }

                if (!string.IsNullOrWhiteSpace(profileId))
                {
                    var byId = profiles.FirstOrDefault(p => string.Equals(p.Id, profileId, StringComparison.OrdinalIgnoreCase));
                    if (byId != null)
                        return byId;
                }

                if (!string.IsNullOrWhiteSpace(uuid))
                {
                    var byUuid = profiles.FirstOrDefault(p => string.Equals(p.UUID, uuid, StringComparison.OrdinalIgnoreCase));
                    if (byUuid != null)
                        return byUuid;
                }
            }
        }
        catch
        {
            // Best effort only
        }

        return null;
    }

    /// <summary>
    /// Extracts a quoted or bare value from a shell variable assignment line
    /// such as <c>KEY="value"</c> or <c>KEY=value</c>.
    /// </summary>
    /// <param name="line">The shell assignment line.</param>
    /// <returns>The extracted value, or an empty string if parsing fails.</returns>
    public static string ExtractQuotedValue(string line)
    {
        var start = line.IndexOf('"');
        var end = line.LastIndexOf('"');
        if (start >= 0 && end > start)
            return line.Substring(start + 1, end - start - 1);

        var parts = line.Split('=', 2);
        return parts.Length == 2 ? parts[1].Trim() : string.Empty;
    }
}
