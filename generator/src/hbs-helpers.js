const Handlebars = require("handlebars");

const toCamel = (s) =>
  String(s).trim()
    .replace(/[\s_-]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/^[A-Z]/, (m) => m.toLowerCase());

const toPascal = (s) =>
  String(s).trim()
    .replace(/(^|[\s_-]+)(.)/g, (_, __, c) => c.toUpperCase())
    .replace(/[\s_-]+/g, "");

const toKebab = (s) =>
  String(s).trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .replace(/[\s_]+/g, "-")
    .toLowerCase();

const toSnake = (s) =>
  String(s).trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();

Handlebars.registerHelper("camel",  (v) => toCamel(v));
Handlebars.registerHelper("pascal", (v) => toPascal(v));
Handlebars.registerHelper("kebab",  (v) => toKebab(v));
Handlebars.registerHelper("snake",  (v) => toSnake(v));
Handlebars.registerHelper("upper",  (v) => String(v).toUpperCase());
Handlebars.registerHelper("lower",  (v) => String(v).toLowerCase());

// aliasok, amik sok sablonban előfordulnak
Handlebars.registerHelper("lc",     (v) => String(v).toLowerCase());
Handlebars.registerHelper("uc",     (v) => String(v).toUpperCase());

Handlebars.registerHelper("json",   (ctx, s) => new Handlebars.SafeString(JSON.stringify(ctx, null, s || 2)));
Handlebars.registerHelper("join",   (arr, sep) => (arr || []).join(sep || ", "));
Handlebars.registerHelper("ifEq", function(a, b, opts) { return (a == b) ? opts.fn(this) : opts.inverse(this); });

// szöveges MySQL/MariaDB típusok felismerése (LIKE kereséshez)
Handlebars.registerHelper("isString", function (type) {
  const t = String(type || "").toLowerCase();
  return /(char|varchar|text|tinytext|mediumtext|longtext|enum|set)/.test(t);
});

module.exports = {};
