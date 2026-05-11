//
//  Blog.swift
//  
//
//  Created by tanabe.nobuyuki on 2020/12/09.
//

import Foundation
import Publish
import Plot

struct Blog: Website {
        
    enum SectionID: String, WebsiteSectionID {
        // Add the sections that you want your website to contain here:
        case posts
    }

    struct ItemMetadata: WebsiteItemMetadata {
        // Add any site-specific metadata that you want to use here.
    }

    // Update these properties to configure your website:
    var url = URL(string: "https://tanabe1478.github.io")!
    var name = "tanabe1478"
    var description = "t__nabe1478のブログです。務め先のブログには書く程でないプログラミングに関することや私事について書きます。"
    var language: Language { .english }
    var imagePath: Path? { "images/logo.png" }
    var favicon: Favicon? { Favicon() }
}
