import Immutable from 'immutable'

import Auth from './Auth'

export class FileReference extends Immutable.Record({
    filepath: null,
    convert: null
}) { }

export class KeyValue extends Immutable.Record({
    key: null,
    value: null,
    valueType: null,
    description: null
}) { }

export class SchemaReference extends Immutable.Record({
    reference: null,
    resolved: false,
    value: null
}) {
    _escapeURIFragment(uriFragment) {
        return uriFragment.replace('~', '~0').replace('/', '~1')
    }

    _unescapeURIFragment(uriFragment) {
        return uriFragment.replace('~1', '/').replace('~0', '~')
    }

    /*
        resolve assumes locally defined schemas.
        uri should respect the following format:
            #/some/path/to/definition
    */
    resolve(schema) {
        let path = this.get('reference').split('/').map(fragment => {
            return this._unescapeURIFragment(fragment)
        }).slice(1)

        let resolved = schema.getInSchema(path)

        if (!resolved) {
            return this
        }
        return this
            .set('resolved', true)
            .set('value', resolved)
    }

    getResolvedSchema() {
        return this.get('value')
    }

    setResolvedSchema(schema) {
        return this.set('value', schema)
    }

    toJS() {
        if (this.get('resolved')) {
            return this.get('value').toJS()
        }
        else {
            return this.get('reference')
        }
    }
}

export class Schema extends Immutable.Record({
    uri: '#',
    value: null,
    map: null,
    raw: null
}) {

    /*
        [RFC:](http://tools.ietf.org/html/draft-ietf-appsawg-json-pointer-07)
        The RFC specifies that '/' have to be replaced by '~1', and therefore
        '~' has to be replaced by '~0'.

        This RFC is referenced by the version of the RFC draft of JSON Schema
        [JSON Schema RFC:](https://tools.ietf.org/html/draft-zyp-json-schema-04)
    */
    _escapeURIFragment(uriFragment) {
        return uriFragment.replace('~', '~0').replace('/', '~1')
    }

    _unescapeURIFragment(uriFragment) {
        return uriFragment.replace('~1', '/').replace('~0', '~')
    }

    mergeSchema(schema) {
        let mergedSchema = this.get('map')
        if (typeof schema === 'object') {
            if (
                (
                    !mergedSchema ||
                    mergedSchema instanceof Immutable.List
                ) && (
                    Array.isArray(schema) ||
                    schema instanceof Immutable.List
                )
            ) {
                mergedSchema = mergedSchema || new Immutable.List()
                let index = 0
                for (let prop of schema) {
                    let subSchema = new Schema()
                    let uri = this.get('uri') + '/' + index
                    subSchema = subSchema
                        .set('uri', uri)
                        .mergeSchema(prop)
                    mergedSchema = mergedSchema.push(subSchema)
                }
            }
            else {
                mergedSchema = this.get('map') || new Immutable.OrderedMap()
                for (let prop of Object.keys(schema)) {
                    if (prop === '$ref') {
                        let schemaReference = new SchemaReference({
                            reference: schema[prop]
                        })
                        mergedSchema = mergedSchema.set(prop, schemaReference)
                    }
                    else {
                        let subSchema = new Schema()
                        let uri = this.get('uri') + '/' +
                            this._escapeURIFragment(prop)
                        subSchema = subSchema
                            .set('uri', uri)
                            .mergeSchema(schema[prop])
                        mergedSchema = mergedSchema.set(prop, subSchema)
                    }
                }
            }
            return this.set('map', mergedSchema)
        }
        else {
            return this.set('value', schema)
        }
    }

    resolve(depth = 0, baseSchema = this) {
        if (this.get('raw')) {
            return this
        }

        if (this.get('value')) {
            return this
        }

        let subSchema = this.get('map') || new Immutable.OrderedMap()
        let auxSchema
        if (subSchema instanceof Immutable.List) {
            auxSchema = new Immutable.List()
        }
        else {
            auxSchema = new Immutable.OrderedMap()
        }
        subSchema.forEach((value, key) => {
            let _value = value
            if (_value instanceof SchemaReference) {
                _value = _value.resolve(baseSchema)
                if (
                    !Immutable.is(
                        Immutable.fromJS(_value),
                        Immutable.fromJS(value)
                    ) &&
                    depth > 0
                ) {
                    let schema = _value.getResolvedSchema()
                        .resolve(depth - 1, baseSchema)
                    _value = _value.setResolvedSchema(schema)
                }
            }
            else {
                _value = _value.resolve(depth, baseSchema)
            }
            if (auxSchema instanceof Immutable.List) {
                auxSchema = auxSchema.push(_value)
            }
            else {
                auxSchema = auxSchema.set(key, _value)
            }
        })

        return this.set('map', auxSchema)
    }

    getInSchema(array, notSetValue) {
        let path = array.reduce((_path, elt) => {
            return _path.concat([ 'map', elt ])
        }, [])
        return this.getIn(path, notSetValue)
    }

    toJS() {
        if (this.get('raw')) {
            return this.get('raw')
        }
        if (this.get('value')) {
            return this.get('value')
        }

        let subSchema = this.get('map') || Immutable.OrderedMap()
        return subSchema.toJS()
    }
}

export default class RequestContext extends Immutable.Record({
    schema: null,
    group: null,
    environments: null
}) {
    mergeEnvironments(environments) {
        let localEnvs = this.get('environments')

        if (!localEnvs) {
            return this.set('environments', environments)
        }

        let envs = environments
        localEnvs.forEach((env) => {
            let localEnv = env
            let merged = false
            environments.forEach((_env) => {
                if (localEnv.get('id') === _env.get('id')) {
                    localEnv = localEnv.mergeDeep(_env)
                    merged = true
                }
            })

            if (!merged) {
                envs = envs.push(env)
            }
        })

        return this.set('environments', envs)
    }

    mergeGroup(group) {
        let localGroup = this.get('group')
        localGroup = localGroup.mergeWithGroup(group)
        return this.set('group', localGroup)
    }
}

export class Response extends Immutable.Record({
    code: null,
    description: null,
    schema: null,
    headers: Immutable.OrderedMap()
}) { }

export class Request extends Immutable.Record({
    id: null,
    name: null,
    description: null,
    url: null,
    method: null,
    headers: Immutable.OrderedMap(),
    queries: null,
    bodyType: null,
    bodyString: null,
    body: null,
    auth: Immutable.List(),
    responses: Immutable.List(),
    timeout: null
}) {

    setAuthType(authType, params) {
        const authMethods = {
            basic: Auth.Basic,
            digest: Auth.Digest,
            ntlm: Auth.NTLM,
            negotiate: Auth.Negotiate,
            apiKey: Auth.ApiKey,
            oauth1: Auth.OAuth1,
            oauth2: Auth.OAuth2,
            awssig4: Auth.AWSSig4,
            hawk: Auth.Hawk
        }

        let auths = this.get('auth').pop()

        if (!authMethods[authType]) {
            throw new Error('Unsupported Authentication Method : ' + authType)
        }

        let auth = new authMethods[authType](params)
        return this.set('auth', auths.push(auth))
    }

    setAuthParams(authParams) {
        let auths = this.get('auth')
        let auth = auths.last()

        // If AuthType was not set beforehand, assume BasicAuth
        if (auth === null || typeof auth === 'undefined') {
            auth = new Auth.Basic()
        }

        auth = auth.merge(authParams)
        return this.set('auth', auths.set(-1, auth))
    }
}

export class Group extends Immutable.Record({
    id: null,
    name: null,
    children: Immutable.OrderedMap()
}) {
    mergeWithGroup(group) {
        let child = this.getIn([ 'children', group.get('name') ])
        if (child) {
            child = child.mergeDeep(group)
        }
        else {
            child = group
        }
        return this.setIn([ 'children', group.get('name') ], child)
    }
}

export class Environment extends Immutable.Record({
    id: null,
    name: null,
    variables: Immutable.OrderedMap()
}) { }

// TODO change referenceName to a more suited name, like components
export class EnvironmentReference extends Immutable.Record({
    environmentName: null,
    referenceName: Immutable.List()
}) { }
