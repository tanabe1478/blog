// Convert a JavaScript string offset to a CodeMirror document position.
// CodeMirror counts each line break as one position, while a CRLF string uses
// two code units. LF strings need no conversion.
export function stringOffsetToDoc(
  text: string,
  offset: number,
  lineBreak: string,
): number {
  if (lineBreak !== "\r\n") return offset;
  let crlf = 0;
  for (let index = 0; index < offset; index++) {
    if (text.charCodeAt(index) === 13 && text.charCodeAt(index + 1) === 10) {
      crlf++;
    }
  }
  return offset - crlf;
}
