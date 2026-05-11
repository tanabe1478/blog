import Foundation
import Publish

extension PublishingStep where Site == Blog {
    static func generateDiaryRedirects() -> Self {
        .step(named: "Generate diary redirects") { context in
            try writeRedirect(to: "/", at: "diary", in: context)

            for item in context.allItems(sortedBy: \.date) {
                guard let issueNumber = diaryIssueNumber(from: item) else { continue }
                try writeRedirect(
                    to: item.path.absoluteString,
                    at: "diary/articles/\(issueNumber)",
                    in: context
                )
            }
        }
    }
}

private func diaryIssueNumber(from item: Item<Blog>) -> String? {
    guard let slug = item.path.string.split(separator: "/").last else { return nil }
    guard slug.hasPrefix("diary-") else { return nil }
    return String(slug.dropFirst("diary-".count))
}

private func writeRedirect(
    to targetPath: String,
    at outputPath: String,
    in context: PublishingContext<Blog>
) throws {
    let folder = try context.createOutputFolder(at: Path(outputPath))
    let file = try folder.createFileIfNeeded(withName: "index.html")
    try file.write(redirectHTML(to: targetPath))
}

private func redirectHTML(to targetPath: String) -> String {
    """
    <!doctype html>
    <html lang=\"en\">
    <head>
      <meta charset=\"utf-8\">
      <meta http-equiv=\"refresh\" content=\"0; url=\(targetPath)\">
      <link rel=\"canonical\" href=\"\(targetPath)\">
      <title>Redirecting...</title>
    </head>
    <body>
      <p>Redirecting to <a href=\"\(targetPath)\">\(targetPath)</a>.</p>
    </body>
    </html>
    """
}
