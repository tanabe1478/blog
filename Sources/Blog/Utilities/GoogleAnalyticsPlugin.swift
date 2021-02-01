//
//  File.swift
//  
//
//  Created by tanabe.nobuyuki on 2021/01/08.
//


import Foundation
import Publish
import Plot

public extension Plugin {
    static func googleAnalytics(trackingID: String) -> Self {
        Plugin(name: "Google Analytics for Tracking ID \(trackingID)") { context in
            context.site.add(
                headNode: .script(
                    .attribute(named: "async", value: nil, ignoreIfValueIsEmpty: false),
                    .src("https://www.googletagmanager.com/gtag/js?id=\(trackingID)")
                )
            )
            
            context.site.add(
                headNode: .script(
                    .text("window.dataLayer = window.dataLayer || [];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config', '\(trackingID)');")
                )
            )
        }
    }
}

private struct CustomNodes {
    private var target: String
    var node: Node<HTML.HeadContext>
    private static var all: [CustomNodes] = []
    static func add<Site: Website>(node: Node<HTML.HeadContext>, for site: Site) {
        self.all.append(CustomNodes(target: String(describing: site.self), node: node))
    }

    static func headNodes<Site: Website>(for site: Site) -> [CustomNodes] {
        self.all.filter { (conditionalHeadNode) -> Bool in
            String(describing: site.self) == String(describing: conditionalHeadNode.target)
        }
    }
}

public extension Website {
    func add(headNode: Node<HTML.HeadContext>) {
        CustomNodes.add(node: headNode, for: self)
    }

    func headNodes(for location: Location) -> [Node<HTML.HeadContext>] {
        CustomNodes.headNodes(for: self).map { $0.node }
    }
}


public extension Node where Context == HTML.DocumentContext {
    static func customHead<T: Website>(
        for location: Location,
        on site: T,
        titleSeparator: String = " | ",
        stylesheetPaths: [Path] = ["/styles.css"],
        rssFeedPath: Path? = .defaultForRSSFeed,
        rssFeedTitle: String? = nil,
        additionalNodes: [Node<HTML.HeadContext>] = []) -> Node {
        var title = location.title

        if title.isEmpty {
            title = site.name
        } else {
            title.append(titleSeparator + site.name)
        }

        var description = location.description

        if description.isEmpty {
            description = site.description
        }

        return .head(
            .encoding(.utf8),
            .siteName(site.name),
            .url(site.url(for: location)),
            .title(title),
            .description(description),
            .twitterCardType(location.imagePath == nil ? .summary : .summaryLargeImage),
            .forEach(stylesheetPaths, { .stylesheet($0) }),
            .viewport(.accordingToDevice),
            .unwrap(site.favicon, { .favicon($0) }),
            .unwrap(rssFeedPath, { path in
                let title = rssFeedTitle ?? "Subscribe to \(site.name)"
                return .rssFeedLink(path.absoluteString, title: title)
            }),
            .unwrap(location.imagePath ?? site.imagePath, { path in
                let url = site.url(for: path)
                return .socialImageLink(url)
            }),
            .forEach(site.headNodes(for: location) + additionalNodes, {$0})
        )
    }
}
