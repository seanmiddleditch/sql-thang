// https://github.com/seanmiddleditch/sql-thang
//
// Copyright 2018 Sean Middleditch
// 
// Permission to use, copy, modify, and/or distribute this software for
// any purpose with or without fee is hereby granted, provided that the
// above copyright notice and this permission notice appear in all copies.
// 
// THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL
// WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE
// AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL
// DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR
// PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS
// ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
// THIS SOFTWARE.

class SQL extends Array {}

const defaults = {
    ident: (id, ctx) => (ctx.params.push(id), '??'),
    value: (val, ctx) => (ctx.params.push(val), '?')
}

const literal = str =>
    () => str

const ident = id =>
    ctx => ctx.personality.ident(id, ctx)

const value = val =>
    ctx => ctx.personality.value(val, ctx)

const embed = sql =>
    ctx => sql.map(part => part(ctx)).join(' ')

const bind = exp =>
    exp instanceof Function ? exp :
    exp instanceof SQL ? embed(exp) :
    value(exp)

const list = (arr, opt = {}) => {
    const join = opt.join || ','
    const prefix = opt.prefix || ''
    const suffix = opt.suffix || ''
    return ctx => {
        const sql = arr.map(val => bind(val)(ctx)).join(` ${join} `)
        return sql !== '' ? `${prefix} ${sql} ${suffix}` : ''
    }
}

const keyed = (obj, opt = {}) => {
    const join = opt.join || ','
    const sep = opt.sep || '='
    const prefix = opt.prefix || ''
    const suffix = opt.suffix || ''
    return ctx => {
        const sql = Object.getOwnPropertyNames(obj)
            .filter(key => typeof obj[key] !== 'undefined')
            .map(key => `${ctx.personality.ident(key, ctx)} ${sep} ${bind(obj[key])(ctx)}`)
            .join(` ${join } `)
        return sql !== '' ? `${prefix} ${sql} ${suffix}` : ''
    }
}

const build = (stmt, personality = defaults) => {
    const params = []
    const ctx = {
        params,
        personality
    }
    const sql = embed(stmt)(ctx)
    return {sql, params}
}

const sql = (strings, ...exp) => {
    const stmt = new SQL()
    strings.forEach((str, idx) => {
        stmt.push(literal(str))
        if (idx < exp.length)
            stmt.push(bind(exp[idx]))
    })
    return stmt
}

module.exports = {
    literal,
    ident,
    value,
    list,
    keyed,
    build,
    sql,
    SQL
}