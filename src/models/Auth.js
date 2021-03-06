import Immutable from 'immutable'

export class BasicAuth extends Immutable.Record({
    username: null,
    password: null,
    raw: null
}) { }

export class DigestAuth extends Immutable.Record({
    username: null,
    password: null
}) { }

export class NTLMAuth extends Immutable.Record({
    username: null,
    password: null
}) { }

export class NegotiateAuth extends Immutable.Record({
    username: null,
    password: null
}) { }

export class ApiKeyAuth extends Immutable.Record({
    name: null,
    in: null,
    key: null
}) { }

export class OAuth1Auth extends Immutable.Record({
    callback: null,
    consumerSecret: null,
    tokenSecret: null,
    consumerKey: null,
    algorithm: null,
    nonce: null,
    additionalParameters: null,
    timestamp: null,
    token: null,
    version: null,
    signature: null,
    tokenCredentialsUri: null,
    requestTokenUri: null,
    authorizationUri: null
}) { }

export class OAuth2Auth extends Immutable.Record({
    flow: null,
    authorizationUrl: null,
    tokenUrl: null,
    scopes: Immutable.List()
}) { }

export class AWSSig4Auth extends Immutable.Record({
    key: null,
    secret: null,
    region: null,
    service: null
}) { }

export class HawkAuth extends Immutable.Record({
    id: null,
    key: null,
    algorithm: null
}) { }

const Auth = {
    Basic: BasicAuth,
    Digest: DigestAuth,
    NTLM: NTLMAuth,
    Negotiate: NegotiateAuth,
    ApiKey: ApiKeyAuth,
    OAuth1: OAuth1Auth,
    OAuth2: OAuth2Auth,
    AWSSig4: AWSSig4Auth,
    Hawk: HawkAuth
}

export default Auth
