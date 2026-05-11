//
//  File.swift
//  
//
//  Created by tanabe.nobuyuki on 2020/12/09.
//

import Foundation
import Publish
import Plot


extension MyHtmlFactory {
    func makeItemHTML(for item: Item<Site>, context: PublishingContext<Site>) throws -> HTML {
        HTML(
            .lang(context.site.language),
            .head(for: item, on: context.site),
            .body(
                .class("item-page"),
                .header(for: context, selectedSection: item.sectionID),
                .wrapper(
                    .article(
                        .header(
                            .class("article-header"),
                            .h1(.text(item.title)),
                            .div(
                                .class("article-meta"),
                                .span(.text(diaryDateFormatter.string(from: item.date)))
                            )
                        ),
                        .div(
                            .class("content"),
                            .contentBody(item.body)
                        ),
                        .tagList(for: item, on: context.site)
                    )
                ),
                .footer(for: context.site)
            )
        )
    }
}
