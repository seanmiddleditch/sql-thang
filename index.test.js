const SQL = require('./index')

expect.extend({
    strippedIs(received, argument) {
        const stripped = received.trim().replace(/ +/g, ' ')
        const pass = stripped === argument
        return {
            pass,
            message: () => `expected '${stripped}' to ${pass ? 'not be' : 'be'} '${argument}'`
        }
    }
})

describe('sql expander', () => {
    describe('core assumptions', () => {
        test('string identity', () => {
            const {sql, params} = SQL.build(SQL.sql`a string ? with no \${placeholders}`)
            expect(sql).strippedIs('a string ? with no ${placeholders}')
            expect(params).toEqual([])
        })

        test('placholders expand params', () => {
            const value = ';'
            const {sql, params} = SQL.build(SQL.sql`SELECT ${value}`)
            expect(sql).strippedIs('SELECT ?')
            expect(params).toEqual([value])
        })

        test('adjacent placeholders', () => {
            const {sql, params} = SQL.build(SQL.sql`${1}${2}${3}`)
            expect(sql).strippedIs('? ? ?')
            expect(params).toEqual([1, 2, 3])
        })

        test('empty inputs', () => {
            const {sql, params} = SQL.build(SQL.sql``)
            expect(sql).strippedIs('')
            expect(params).toEqual([])
        })
    })

    describe('modifiers', () => {
        test('value', () => {
            const value = 'foo'
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.value(value)}`)
            expect(sql).strippedIs('SELECT ?')
            expect(params).toEqual([value])
        })
        test('identifier', () => {
            const value = 'foo'
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.ident(value)}`)
            expect(sql).strippedIs('SELECT ??')
            expect(params).toEqual([value])
        })
        test('literal', () => {
            const value = 'foo'
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.literal(value)}`)
            expect(sql).strippedIs('SELECT foo')
            expect(params).toEqual([])
        })
    })

    describe('list expansion', () => {
        test('defaults', () => {
            const values = [1, 2]
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.list(values)}`)
            expect(sql).strippedIs('SELECT ? , ?')
            expect(params).toEqual(values)
        })
        test('empty', () => {
            const values = []
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.list(values)}`)
            expect(sql).strippedIs('SELECT')
            expect(params).toEqual(values)
        })
        test('options', () => {
            const values = [1, 2]
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.list(values, {prefix: 'WHERE', join: 'AND', suffix: 'ORDER BY'})}`)
            expect(sql).strippedIs('SELECT WHERE ? AND ? ORDER BY')
            expect(params).toEqual(values)
        })
        test('empty with prefix', () => {
            const values = []
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.list(values, {prefix: 'WHERE', join: 'AND', suffix: 'ORDER BY'})}`)
            expect(sql).strippedIs('SELECT')
            expect(params).toEqual([])
        })
    })

    describe('map expansion', () => {
        test('defaults', () => {
            const object = {foo: 1, bar: 2}
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.keyed(object)}`)
            expect(sql).strippedIs('SELECT ?? = ? , ?? = ?')
            expect(params).toEqual(['foo', 1, 'bar', 2])
        })
        test('empty', () => {
            const object = {}
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.keyed(object)}`)
            expect(sql).strippedIs('SELECT')
            expect(params).toEqual([])
        })
        test('undefined', () => {
            const object = {undef: undefined}
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.keyed(object)}`)
            expect(sql).strippedIs('SELECT')
            expect(params).toEqual([])
        })
        test('options', () => {
            const object = {foo: 1, bar: 2}
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.keyed(object, {prefix: 'WHERE', join: 'AND', suffix: 'ORDER BY', sep: '=='})}`)
            expect(sql).strippedIs('SELECT WHERE ?? == ? AND ?? == ? ORDER BY')
            expect(params).toEqual(['foo', 1, 'bar', 2])
        })
        test('empty with prefix', () => {
            const object = {}
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.keyed(object, {prefix: 'WHERE', join: 'AND', suffix: 'ORDER BY', sep: '=='})}`)
            expect(sql).strippedIs('SELECT')
            expect(params).toEqual([])
        })
    })

    describe('postgres personality', () => {
        const personality = {
            ident: id => `"${id.replace(/"/g, '""')}"`,
            value: (val, ctx) => `$${ctx.params.push(val)}`
        }

        test('basics', () => {
            const value = 'foo'
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.value(value)}`, personality)
            expect(sql).strippedIs('SELECT $1')
            expect(params).toEqual([value])
        })

        test('maps', () => {
            const object = {foo: 1, SELECT: 2, ';': 3}
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.keyed(object)}`, personality)
            expect(sql).strippedIs('SELECT "foo" = $1 , "SELECT" = $2 , ";" = $3')
            expect(params).toEqual([1, 2, 3])
        })
    })

    describe('statement embedding', () => {
        test('simple embedding', () => {
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.sql`* FROM`} table`)
            expect(sql).strippedIs('SELECT * FROM table')
            expect(params).toEqual([])
        })

        test('parameter embedding', () => {
            const values = ['foo', 'bar']
            const {sql, params} = SQL.build(SQL.sql`SELECT ${SQL.sql`* FROM ${SQL.ident(values[0])}`} WHERE ${values[1]}`)
            expect(sql).strippedIs('SELECT * FROM ?? WHERE ?')
            expect(params).toEqual(['foo', 'bar'])
        })
    })
})