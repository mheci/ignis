const fs = require("fs");
const path = require("path");

const dir = __dirname;
const parts = [];
for (let p = 1; p <= 6; p++) {
  parts.push(fs.readFileSync(path.join(dir, "src", "part" + p + ".js"), "utf8"));
}
const src = parts.join("\n").replace(/\r\n/g, "\n");

const marker = "// ==/UserScript==";
const headerEnd = src.indexOf(marker);
const header = src.slice(0, headerEnd + marker.length);
let body = src.slice(header.length);

let out = "";
let i = 0;
const n = body.length;

function regexStartsAt(idx) {
  const prev = body.slice(0, idx).replace(/\s+$/, "");
  if (!prev) return true;
  const last = prev[prev.length - 1];
  if ("([{=,:;!&|?+-*%^~<>".indexOf(last) > -1) return true;
  if (/(?:^|\s)(?:return|typeof|instanceof|in|of|new|delete|void|case|throw|do|else|yield|await)\s*$/.test(prev)) return true;
  return false;
}

while (i < n) {
  const c = body[i];
  const c2 = body[i + 1];
  if (c === "/" && c2 === "/") {
    while (i < n && body[i] !== "\n") i++;
    continue;
  }
  if (c === "/" && c2 === "*") {
    i += 2;
    while (i < n && !(body[i] === "*" && body[i + 1] === "/")) i++;
    i += 2;
    continue;
  }
  if (c === "'" || c === '"') {
    const q = c;
    out += c;
    i++;
    while (i < n) {
      out += body[i];
      if (body[i] === "\\") {
        i++;
        if (i < n) {
          out += body[i];
          i++;
        }
        continue;
      }
      if (body[i] === q) {
        i++;
        break;
      }
      i++;
    }
    continue;
  }
  if (c === "`") {
    out += c;
    i++;
    while (i < n) {
      if (body[i] === "\\") {
        out += body[i];
        i++;
        if (i < n) {
          out += body[i];
          i++;
        }
        continue;
      }
      if (body[i] === "`") {
        out += body[i];
        i++;
        break;
      }
      out += body[i];
      i++;
    }
    continue;
  }
  if (c === "/") {
    if (regexStartsAt(i)) {
      let j = i + 1;
      let inClass = false;
      while (j < n) {
        if (body[j] === "\\") {
          j += 2;
          continue;
        }
        if (body[j] === "[") inClass = true;
        else if (body[j] === "]") inClass = false;
        else if (body[j] === "/" && !inClass) break;
        j++;
      }
      j++;
      while (j < n && /[a-z]/i.test(body[j])) j++;
      out += body.slice(i, j);
      i = j;
      continue;
    }
  }
  out += c;
  i++;
}

out = out
  .split("\n")
  .map((l) => l.replace(/[ \t]+$/g, ""))
  .join("\n")
  .replace(/\n{3,}/g, "\n\n");

const final = header + "\n" + out;
const dest = process.argv[2] || path.join(dir, "ignis.user.js");
fs.writeFileSync(dest, final);
console.log("built:", dest, "bytes:", final.length, "lines:", final.split("\n").length);
