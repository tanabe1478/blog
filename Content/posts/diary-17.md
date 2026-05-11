---
date: 2025-03-04 03:28
description: ""
tags: diary
---

# GmailをGeminiにつなげる方法

Gmail をソースにして Gemini に確認できるようになる。

## Geminiの設定

1. Geminiを開く
2. 右上の歯車マーク(設定)をクリック
3. 「拡張機能」を選択
4. Google Workspace拡張機能をオンにする

## 使用時の注意点

- Gemini 2.0 Flash を使用する必要がある
  - "2.0 Flash Thinking Experimental with apps" では Gmail を読み込めない
- メールの指示は日時を明確にする
  - 「最近来たメール」などの曖昧な表現だとGeminiが古いメールを参照してしまう
  - 例: 「2024/03/14に受信したメール」のように具体的に指定する

## Tips

- 複数のメールアドレスを持っている場合は、1つのGmailアドレスに全て転送設定しておくと管理が楽
