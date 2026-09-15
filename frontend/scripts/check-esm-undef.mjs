/* Find free identifiers that ESM will throw as ReferenceError.
   Legacy Babel-in-browser shared one global scope; Vite modules do not.
   Run: node scripts/check-esm-undef.mjs */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse } from "@babel/parser";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "src");

const GLOBALS = new Set([
  "undefined", "NaN", "Infinity", "arguments", "this",
  "Object", "Array", "String", "Number", "Boolean", "RegExp", "Date", "Math", "JSON",
  "Map", "Set", "WeakMap", "WeakSet", "Promise", "Symbol", "Proxy", "Reflect",
  "Error", "TypeError", "ReferenceError", "RangeError", "SyntaxError", "URIError",
  "parseInt", "parseFloat", "isNaN", "isFinite", "encodeURIComponent", "decodeURIComponent",
  "encodeURI", "decodeURI", "escape", "unescape", "eval",
  "Intl", "console", "window", "document", "navigator", "location", "history",
  "localStorage", "sessionStorage", "fetch", "Headers", "Request", "Response",
  "FormData", "Blob", "File", "FileReader", "URL", "URLSearchParams", "AbortController",
  "EventSource", "WebSocket", "Image", "Option", "Event", "CustomEvent", "MutationObserver",
  "ResizeObserver", "IntersectionObserver", "setTimeout", "clearTimeout", "setInterval",
  "clearInterval", "requestAnimationFrame", "cancelAnimationFrame", "queueMicrotask",
  "atob", "btoa", "alert", "confirm", "prompt", "structuredClone", "crypto", "performance",
  "HTMLElement", "Node", "Element", "Text", "DocumentFragment", "DOMParser",
  "Uint8Array", "Uint16Array", "Uint32Array", "Int8Array", "Int16Array", "Int32Array",
  "Float32Array", "Float64Array", "ArrayBuffer", "DataView", "TextEncoder", "TextDecoder",
  "XMLHttpRequest", "ReactDOM", "File", "FileList",
  "globalThis", "self", "process", "module", "exports", "require", "Buffer",
  "React", "jsx", "jsxs", "Fragment",
]);

function walkDir(dir, acc = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walkDir(p, acc);
    else if (/\.(jsx|js)$/.test(ent.name)) acc.push(p);
  }
  return acc;
}

function collect(node, fn, parent = null, key = null) {
  if (!node || typeof node !== "object") return;
  fn(node, parent, key);
  for (const k of Object.keys(node)) {
    if (k === "loc" || k === "start" || k === "end" || k === "extra" || k === "errors") continue;
    const child = node[k];
    if (Array.isArray(child)) child.forEach((c, i) => collect(c, fn, node, k));
    else if (child && typeof child === "object" && child.type) collect(child, fn, node, k);
  }
}

function skipRef(node, parent, key) {
  if (!parent) return false;
  if (parent.type === "MemberExpression" && parent.property === node && !parent.computed) return true;
  if (parent.type === "OptionalMemberExpression" && parent.property === node && !parent.computed) return true;
  if (parent.type === "ObjectProperty" && parent.key === node && !parent.computed) return true;
  if (parent.type === "ObjectMethod" && parent.key === node && !parent.computed) return true;
  if (parent.type === "ClassMethod" && parent.key === node && !parent.computed) return true;
  if (parent.type === "ClassProperty" && parent.key === node && !parent.computed) return true;
  if (parent.type === "ImportSpecifier" || parent.type === "ImportDefaultSpecifier" || parent.type === "ImportNamespaceSpecifier") return true;
  if (parent.type === "ExportSpecifier") return true;
  if (parent.type === "LabeledStatement" && parent.label === node) return true;
  if (parent.type === "BreakStatement" || parent.type === "ContinueStatement") return true;
  if (parent.type === "MetaProperty") return true;
  if (parent.type === "JSXAttribute" && parent.name === node) return true;
  if (parent.type === "JSXClosingElement") return true;
  if (parent.type === "JSXOpeningElement" && parent.name === node && node.type === "JSXIdentifier") {
    // component names ARE references — don't skip
  }
  if (key === "imported" || key === "exported" || key === "label") return true;
  return false;
}

function declareFromPattern(pat, into) {
  if (!pat) return;
  if (pat.type === "Identifier") into.add(pat.name);
  else if (pat.type === "AssignmentPattern") declareFromPattern(pat.left, into);
  else if (pat.type === "RestElement") declareFromPattern(pat.argument, into);
  else if (pat.type === "ArrayPattern") (pat.elements || []).forEach((el) => declareFromPattern(el, into));
  else if (pat.type === "ObjectPattern") (pat.properties || []).forEach((p) => {
    if (p.type === "RestElement") declareFromPattern(p.argument, into);
    else declareFromPattern(p.value || p, into);
  });
}

function scanFile(file) {
  const source = fs.readFileSync(file, "utf8");
  let ast;
  try {
    ast = parse(source, { sourceType: "module", plugins: ["jsx"], errorRecovery: true });
  } catch (e) {
    return [{ name: `(parse) ${e.message}`, line: 0 }];
  }
  const declared = new Set();
  const refs = [];

  collect(ast, (node, parent, key) => {
    if (node.type === "ImportDeclaration") {
      (node.specifiers || []).forEach((s) => declared.add(s.local.name));
    }
    if (node.type === "FunctionDeclaration" && node.id) declared.add(node.id.name);
    if (node.type === "FunctionExpression" && node.id) declared.add(node.id.name);
    if (node.type === "ClassDeclaration" && node.id) declared.add(node.id.name);
    if (node.type === "ClassExpression" && node.id) declared.add(node.id.name);
    if (node.type === "VariableDeclarator") declareFromPattern(node.id, declared);
    if ((node.type === "FunctionDeclaration" || node.type === "FunctionExpression" || node.type === "ArrowFunctionExpression" || node.type === "ClassMethod" || node.type === "ObjectMethod") && node.params) {
      node.params.forEach((p) => declareFromPattern(p, declared));
    }
    if (node.type === "CatchClause" && node.param) declareFromPattern(node.param, declared);
    if (node.type === "ImportNamespaceSpecifier" || node.type === "ImportDefaultSpecifier") declared.add(node.local.name);

    if (node.type === "Identifier") {
      if (skipRef(node, parent, key)) return;
      if (parent && (parent.type === "FunctionDeclaration" || parent.type === "ClassDeclaration") && parent.id === node) return;
      if (parent && parent.type === "VariableDeclarator" && parent.id === node) return;
      refs.push(node);
    }
    if (node.type === "JSXIdentifier") {
      if (parent && parent.type === "JSXOpeningElement" && parent.name === node) {
        if (/^[A-Z]/.test(node.name) || node.name === "Fragment") refs.push(node);
      }
      if (parent && parent.type === "JSXMemberExpression" && parent.object === node) refs.push(node);
    }
  });

  const hits = [];
  const seen = new Set();
  for (const id of refs) {
    const name = id.name;
    if (!name || GLOBALS.has(name) || declared.has(name)) continue;
    const key = `${name}:${id.loc && id.loc.start.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    hits.push({ name, line: id.loc ? id.loc.start.line : 0 });
  }
  return hits;
}

const files = walkDir(root);
const problems = [];
for (const file of files) {
  const hits = scanFile(file);
  if (hits.length) problems.push({ file: path.relative(root, file).replaceAll("\\", "/"), hits });
}

if (!problems.length) {
  console.log("check-esm-undef: 0 undeclared identifiers");
  process.exit(0);
}

for (const p of problems) {
  console.log(p.file);
  for (const h of p.hits) console.log(`  L${h.line}  ${h.name}`);
}
console.log(`\ncheck-esm-undef: ${problems.reduce((n, p) => n + p.hits.length, 0)} undeclared in ${problems.length} files`);
process.exit(1);
