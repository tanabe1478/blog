import Foundation
import Publish
import Plot
import HighlightJSPublishPlugin
import TwitterPublishPlugin
import YoutubePublishPlugin


try Blog().publish(using: [
    .installPlugin(.highlightJS()),
    .installPlugin(.twitter()),
    .installPlugin(.youtube()),
    .addMarkdownFiles(),
    .generateHTML(withTheme: .myTheme),
    .copyResources(),
    .sortItems(by: \.date, order: .descending),
    .generateRSSFeed(including: [.posts]),
    .generateSiteMap(),
    .deploy(using: .gitHub("tanabe1478/tanabe1478.github.io", useSSH: true)),
])

