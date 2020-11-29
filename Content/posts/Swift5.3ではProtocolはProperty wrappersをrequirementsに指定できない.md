---
date: 2020-11-29 20:40
description: Combineとprotocolの話
tags: 技術,
---

# Swift5.3ではProtocolはPropertywrappersをrequirementsに指定できない

WWDC2019で発表されたCombineですが、SwiftUIと組み合わせて使用しやすいよう設計されているように感じますが、UIKitを使用しているアプリで使用できないわけではありません。不足しているUIKitのPublisherを提供するCombineCocoaなども提供されています。

[CombineCommunity/CombineCocoa](https://github.com/CombineCommunity/CombineCocoa)

Combineを案件で使っていて困ったことを小ネタですが記事にします。

## Property `xxx` declared inside a protocol cannot have a wrapper

DI出来るようにモジュールを設計する時にprotocolで抽象を表現して利用する側はprotoclに依存させようとしました。DIコンテナ経由で初期化したい時に`@Publish`が付いたプロパティを宣言したくて試しに付けてみたらコンパイルエラーになりました。

```swift
protocol PrinterDiscoverable {
    @Published var token: String? { get set }
    func discover()
}
```

```bash
Property 'token' declared inside a protocol cannot have a wrapper
```

## Publisherについて

Published attribute について知る前にPublisherについて知っておく必要があります。PublisherはCombineの用語でイベントを送信するオブジェクトのことを指します。PublisherをsubscribeしてSubscriberはイベントを受信できます。

```swift
public struct Publisher : Publisher {
    public typealias Output = Wrapped
    public typealias Failure = Never
    public let output: Optional<Wrapped>.Publisher.Output?
    public init(_ output: Optional<Wrapped>.Publisher.Output?)
    public func receive<S>(subscriber: S) where Wrapped == S.Input, S : Subscriber, S.Failure == Never
}
```

Publisherのドキュメントは以下です。

[Apple Developer Documentation](https://developer.apple.com/documentation/combine/publisher)

SwifftのSequence protocolに生えているpublisherというプロパティを使ってPublisherの動作を見ます。

```swift
import Combine

let publisher = [1, 2, 3, 4, 5, 6].publisher
var subscriptions = Set<AnyCancellable>()

publisher.sink(receiveCompletion: { completion in
    print("completed: \(completion)")
}, receiveValue: { value in
    print("received: \(value)")
}).store(in: &subscriptions)
```

Sequence protocolに準拠しているArrayからPublisherを生成してそれをsubscribeします。Publisherは要素を順番にPublisherして最後にfinished をpublishしています。

```bash
received: 1
received: 2
received: 3
received: 4
received: 5
received: 6
completed: finished
```

## `@Published`について

Property Wrappersという機能を使っていて、このattributeが付与されたプロパティをPublisherにすることができます。

@Published`に関するドキュメントは以下です。

[Apple Developer Documentation](https://developer.apple.com/documentation/combine/published)

Property wrappersについては一度記事を書いたことがあります。

[腑に落ちるまでProperty wrappers | Developers.IO](https://dev.classmethod.jp/articles/property-wrappers/)

これにより普通のプロパティからPublisherを生成できて楽です。Combineの恩恵を感じながら実装を続けていたのですが実装後に抽象化する時にprotocol側で`@Published`を付与したプロパティをprotocolのrequirementsに含めようとすると先程のコンパイルエラーに遭遇しました。

## Swift5.3ではProtocolはProperty wrappersをrequirementsに指定できない

Swift5.2、5.3ではプロトコル内でのProperty Wrappersの宣言をサポートしていません。しかし実装はしないといけないので少しコードを修正して同じ要件を満たすようにしました。

利用者側のコードをまず見てみます。

```swift
printerDiscovery.token.sink { [weak self] value in
    guard let token = value else { return }
    target = token
    self?.showNext(token: token)
}.store(in: &subscriptions)
```

@Publishedが付与されたtokenのprojected valueを使ってpublisherをsubscribeしています。つまり今回の場合利用者側で実際に必要なのはPublisherで、@Publishedが付与されたproperty wrapperではないです。

そこでprotocolを以下のように書きかえます。

```swift
protocol PrinterDiscoverable {
    var tokenPublisher: Published<String?>.Publisher { get }
    func discover()
}
```

protocolに準拠する側の実装は以下のようにします。とあるプリンタのプロプライエタリなSDKで規約上実装を公開してはいけないので命名をこちらで変更しています。

```swift
struct PrinterDiscovery: NSObject, DiscoveryDelegate, PrinterDiscoverable {
    @Published private(set) var token: String?
    var tokenPublished: Published<String?> { _token }
    var tokenPublisher: Published<String?>.Publisher { $token }

    private var printerList: [DeviceInfo] = []
    private var filterOption = Epos2FilterOption()

    func discover() {
        filterOption.deviceType = TYPE_PRINTER.rawValue
        let result = Discovery.start(filterOption, delegate: self)
    }

    func onDiscovery(_ deviceInfo: Epos2DeviceInfo!) {
        printerList.append(deviceInfo)
        token = printerList.first?.target ?? "取得失敗"
    }
}
```

利用する側もコードの修正が必要になります。

```swift
printerDiscovery.tokenPublisher.sink { [weak self] value in
    guard let token = value else { return }
    target = token
    self?.showNext(token: token)
}.store(in: &subscriptions)
```

このワークアラウンドを使って@Pubhlishedなproperty wrapperを公開している実装も見かけました。以下のようにprotocolを宣言していました。

```swift
// protocol
protocol PrinterDiscoverable {
    var token: String { get }
    var tokenPublisher: Published<String?>.Publisher { get }
    var tokenPublished: Published<String?>. { get }
    func discover()
}
```

この実装は以下のリンクなどで触れられています。

[How to define a protocol to include a property with @Published property wrapper](https://stackoverflow.com/questions/57517320/how-to-define-a-protocol-to-include-a-property-with-published-property-wrapper)

[How to Define a Protocol With @Published Property Wrapper Type](https://medium.com/swlh/how-to-define-a-protocol-with-published-property-wrapper-type-1b6349097064)

## まとめ

運良く実務でCombineを使うことができているのでハマりながらこのフレームワークに慣れていければと思います。もっと良い解決方法等何かご意見がある場合はコメントかTwitterの方からご連絡いただければと思います。最後まで読んでいただいてありがとうございました。

## 参考にした記事

[【iOS】Combineフレームワークまとめ - Qiita](https://qiita.com/shiz/items/5efac86479db77a52ccc)

[SwiftのCombineを知る](https://medium.com/@shiba1014/swift%E3%81%AEcombine%E3%82%92%E7%9F%A5%E3%82%8B-fad8e3d902fe)

