SQL Thang
=========

- https://github.com/seanmiddleditch/sql-thang
- by Sean Middleditch

A simple bare-bones SQL placholder library based on ES6 string templates.

It was inspired by https://github.com/felixfbecker/node-sql-template-strings.

Usage
-----

The two most important functions in the library are `sql` and `build`.

The `sql` function is the template driver. Use it as an ES6 string template and it will return an array of functions, which is the intermediate representation of sql-thang.

```javascript
const { sql } = require('sql-thang')
const stmt = sql`SELECT * FROM mytable WHERE foo=${value}`
```

The `build` function converts an array of functions into an object with a `sql` string and a `params` array, suitable for passing to a database backend. By default, the escaping rules match those of mysqljs, but the personality can be changed for Postgres (or any other database) compatibility.

```javascript
const { build, sql } = require('sql-thang')
const value = 12345
const query = build(sql`SELECT * FROM mytable WHERE foo=${value}`)
// query.sql --    'SELECT * FROM mytable WHERE foo= ? '
// query.params -- [12345]
```

Note that the return value of the `sql` function is a special type of array using the `SQL` constructor. This allows safe embedding of SQL statements with proper escaping.

```javascript
const fragment = sql`FROM mytable WHERE id=${id}`
const complete = build(sql`SELECT * ${fragment} AND title=${title}`)
// complete.sql --    'SELECT * FROM mytable WHERE id= ? AND title= ?
// complete.params -- [id, title]
```

The `SQL` type can also be detected using the `instanceof` operator for safe DB abstractions. The `SQL` type uses the `Array` prototype chain. This offers some convenience with manipulating, such as being able to `concat` or `map` them, though this should not regularly be needed outside of debugging purposes.

Special Values
--------------

sql-thang includes a few additional functions for special replacement needs. The three most common are `literal`, `ident`, and `value`.

The default behavior of sql-thang for any template replacement is equivalent to `value`.

The behavior of `literal` is to disable escaping or placeholder behavior and to insert raw unmodified text into the result.

```javascript
const value = 'foo'
const query = build(sql`${value} ${ident(value)}`)
// query.sql --    '? foo'
// query.params -- ['foo']
```

The behavior of `ident` is to insert an escaped identifier or identifier placeholder in the resulting output. By default, using the mysqljs personality, an identifier is inserted into the SQL text as `??` and the identifier value is pushed into the params array. This can be overridden (see #Personalities below) for compatibility with database drivers like node-pg.

There are additionally two more replacement functions, `list` and `keyed`. These are used to splat an array of values or an object of key-value pairs into the output. Unlike with the default functionality provided by some database drivers for this purpose, these helpers also allow settings options for joining and separating characters, and for prefix or suffix strings that are only generated if the result would be non-empty. This is particularly useful for `WHERE` queries, for example. For `keyed`, both identifier and value will be escaped or use placeholders as appropriate for protection from injection attacks.

```javascript
const params = {category: 7, title: 'test'}
const query = build(sql`SELECT * FROM post ${keyed(params, {prefix: 'WHERE', join: 'AND'})}`)
// query.sql --    'SELECT * FROM post WHERE ?? = ? AND ?? = ? '
// query.params -- ['category', 7, 'title', 'test']
```

The purpose of `prefix` is clear when an empty input (or input with only `undefined` values) is provided:

```javascript
const params = {category: undefined}
const query = build(sql`SELECT * FROM post ${keyed(params, {prefix: 'WHERE', join: 'AND'})}`)
// query.sql --    'SELECT * FROM post'
// query.params -- []
```

Users of this functionality may with to write a helper like:

```javascript
const where = (obj, opt = {}) =>
    keyed(obj, {join: 'AND', ...opt, prefix: 'WHERE'})
```

Note: while identifiers will be escaped, it's still an error to reference unknown columns in SQL. Always sanitize input objects and their keys before using them in a query, even with a libray like sql-thang!

More complex conditional replacement cases can be handled via plain ol' JavaScript and proper use of `ident` and `literal`.

Personalities
-------------

A secondary parameter passed to `build` is the personality used for compilation. It must be an option with two members: `ident` and `value`. Each will receive an input and a context object, which together can be used to escape any identifier or value. The functions should return the raw text that will be inserted into the SQL string returned by `build`.

An example Postgres personality might look like:

```javascript
const postgre = {
    ident: id => `"${id.replace(/"/+, '""')}"`, // 'foo' -> '"foo"'
    value: (val, ctx) => `$${ctx.params.push(val)}` // val -> '$1' , params+=[val]
}

const col = 'foo'
const value = 123
const query = build(sql`SELECT * FROM mytable WHERE ${ident(col)}=${value}`, postgre)
// query.sql --    'SELECT * FROM mytable WHERE "foo" = $1 '
// query.params -- [123]
```

The context object provided as the second argument to the personality functions has two properites, `personality` and `params`. The personality refers back to the personality itself. The `params` array is the value that is returned by the `build` function; a personality can choose to escape an identifier or value and return that directly (for drivers that don't support placeholders, for example, or debug logging), or the personality can insert values into the `params` array and return an appropriate placeholder token.

The default personality is implemented roughly as:

```javascript
const defaults = {
    ident: (id, ctx) => ('??', ctx.params.push(id)), // 'foo' -> '??' , params+=['foo']
    value: (val, ctx) => ('?', ctx.params.push(val)) // val -> '?' , params+=[val]
}
```

Custom Modifiers
----------------

Statements returned `sql` are just arrays of functions. The `build` function does relatively little; it constructs a context object and then maps the input array's functions over the context, returning the result joined by whitespace. In other words, a custom modifier is any function that takes a context object and returns some SQL text.

The modifiers like `ident` or `literal` or even the default `value` are thus implemented with the most obvious and trivial implementation. For example, the `ident` function is:

```javascript
const ident = (id, ctx) => ctx.personality.ident(id, ctx)
```

If the provided modifiers aren't sufficient, custom modifiers can easily be written. The `personality` property of the context object can be used to safely quote identifiers and values, generating placeholders if necessary.

Note: it's recommended to ensure that spaces are placed around any generated SQL fragments in a modifier. This is done auotmatically between template expressions, but should be done within modifiers if they're composed of multiple pieces. Without spaces, seemingly independent template expressions might "join" together into new tokens or keywords in the final SQL text.