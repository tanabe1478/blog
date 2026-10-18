///|
fn fail(message : String) -> Unit {
  @fs.write_string_to_file("/dev/stderr", "blog: \{message}\n") catch {
    _ => ()
  }
  @sys.exit(1)
}

///|
fn usage() -> String {
  "usage: build CONTENT RESOURCES OUTPUT [BUILD_DATE]\n  BUILD_DATE: yyyy-MM-ddTHH:mm:ss with optional +HHMM (default: now in JST)"
}

///|
fn main {
  let args = @env.args()
  if args.length() != 4 && args.length() != 5 {
    fail(usage())
    return
  }
  let build_date = if args.length() == 5 {
    match @ssg.BuildDate::parse(args[4]) {
      Some(date) => date
      None => {
        fail(usage())
        return
      }
    }
  } else {
    @site.current_build_date()
  }
  @site.build_site(@site.blog_config(), args[1], args[2], args[3], build_date~) catch {
    @fs.IOError(message) => {
      fail("unable to build site: \{message}")
      return
    }
  }
  println("Generated site at \{args[3]}")
}
