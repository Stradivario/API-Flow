import fs from 'fs'
import path from 'path'
import info from '../../package.json'
import { ArgumentParser, RawTextHelpFormatter } from 'argparse'

import Options from '../models/options/Options'

import SwaggerParser from '../parsers/swagger/Parser'
import RAMLParser from '../parsers/raml/Parser'
import PostmanParserV1 from '../parsers/postman/v1/Parser'
import PostmanParserV2 from '../parsers/postman/v2/Parser'
import CurlParser from '../parsers/cURL/Parser'

import SwaggerSerializer from '../serializers/swagger/Serializer'
import RAMLSerializer from '../serializers/raml/Serializer'
import PostmanSerializer from '../serializers/postman/Serializer'
import CurlSerializer from '../serializers/cURL/Serializer'

import ContextResolver from '../resolvers/ContextResolver'
import NodeEnvironment from '../models/environments/NodeEnvironment'

export default class FlowCLI {
    constructor() {}

    detect(content) {
        let parserMap = {
            swagger: SwaggerParser,
            raml: RAMLParser,
            'postman-1': PostmanParserV1,
            'postman-2': PostmanParserV2,
            curl: CurlParser
        }

        let score = {}

        let parsers = Object.keys(parserMap)
        for (let parser of parsers) {
            let _parser = new parserMap[parser]()
            score[parser] = _parser.detect(content)
        }

        return score
    }

    _createParser() {
        let parser = new ArgumentParser({
            version: info.version,
            addHelp: true,
            formatterClass: RawTextHelpFormatter,
            description: info.description
        })

        parser.addArgument([ 'source' ], {
            help: 'The source file'
        })

        parser.addArgument([ '-d', '--detect' ], {
            metavar: 'file',
            help:
                'If this option is set, returns the format of the input file',
            nargs: 0,
            action: 'storeTrue'
        })

        parser.addArgument([ '-c', '--config' ], {
            metavar: 'path',
            help:
                'The path to a JSON file representing the base options of ' +
                'the command. These values are overriden by config values ' +
                'provided directly as arguments',
            nargs: 1
        })

        parser.addArgument([ '-f', '--from' ], {
            metavar: 'format',
            help:
                'The format of the source file',
            choices: [ 'swagger', 'raml', 'postman-1', 'postman-2' ],
            defaultValue: [ 'swagger' ],
            nargs: 1,
            action: 'store'
        })

        parser.addArgument([ '-t', '--to' ], {
            metavar: 'format',
            help:
                'The format of the destination file',
            choices: [ 'swagger', 'raml', 'postman', 'curl' ],
            defaultValue: [ 'raml' ],
            nargs: 1,
            action: 'store'
        })

        parser.addArgument([ '-b', '--base' ], {
            metavar: 'location',
            help:
                'The location of the source file. If the location is set to ' +
                'raw, the input source will expect the content instead of a ' +
                'path or url',
            choices: [ 'local', 'remote', 'raw' ],
            defaultValue: [ 'local' ],
            nargs: 1
        })

        parser.addArgument([ '-r', '--ref' ], {
            metavar: [ 'uri', 'solve', 'val' ],
            help:
                'uri:   The uri of the reference\n' +
                'solve: A boolean describing whether to resolve ' +
                'the reference\n' +
                'val:   The value to use for the reference\n' +
                'All 3 parameters are required.',
            nargs: 3,
            action: 'append'
        })

        parser.addArgument([ '-p', '--param' ], {
            metavar: [ 'key', 'val' ],
            help:
                'key: The key of the parameter\n' +
                'val: The value to use for the parameter\n' +
                'Both parameters are required.',
            nargs: 2,
            action: 'append'
        })

        return parser
    }

    processArguments(parser) {
        let args = parser.parseArgs()

        let config = new Options()
        if (args.config) {
            try {
                let baseData = fs.readFileSync(args.config).toString()
                let baseJSON = JSON.parse(baseData)
                config = new Options(baseJSON)
            }
            catch (e) {
                config = new Options()
            }
        }

        if (args.from) {
            config = config
                .setIn([ 'parser', 'name' ], args.from[0])
                .setIn([ 'parser', 'isDefault' ], false)
        }

        if (args.to) {
            config = config.setIn([ 'serializer', 'name' ], args.to[0])
        }

        if (args.base) {
            config = config.setIn([ 'resolver', 'base' ], args.base[0])
        }

        if (args.ref || args.param) {
            let refs = (args.ref || []).map(ref => {
                return {
                    uri: ref[0],
                    resolve: ref[1],
                    value: ref[2]
                }
            })
            let params = (args.param || []).map(param => {
                return {
                    key: param[0],
                    value: param[1]
                }
            })

            let resolution = config.getIn([ 'resolver', 'resolve' ])
            resolution = resolution.addCustomResolutions(
                refs.concat(params)
            )

            config = config.setIn([ 'resolver', 'resolve' ], resolution)
        }

        this.options = config
        this.input = args.source
        this.useDetect = args.detect || null
    }

    transform(_input, _options, _callback) {
        let input = _input || this.input
        let options = _options || this.options

        if (!(options instanceof Options)) {
            options = new Options(options)
        }

        let parserMap = {
            swagger: SwaggerParser,
            raml: RAMLParser,
            'postman-1': PostmanParserV1,
            'postman-2': PostmanParserV2,
            curl: CurlParser
        }

        let serializerMap = {
            swagger: SwaggerSerializer,
            raml: RAMLSerializer,
            postman: PostmanSerializer,
            curl: CurlSerializer
        }

        let callback = _callback
        if (!callback) {
            callback = (data) => {
                /* eslint-disable no-console */
                console.log(data)
                /* eslint-enable no-console */
            }
        }

        let content
        let item
        if (options.getIn([ 'resolver', 'base' ]) === 'local') {
            let _path = path.resolve('./', input)
            content = fs.readFileSync(_path).toString()
            item = {
                file: {
                    name: path.basename(_path),
                    path: path.dirname(_path)
                },
                content: content
            }
        }
        else {
            content = input
            item = {
                file: {
                    name: '',
                    path: path.resolve('.')
                },
                content: content
            }
        }

        let source
        if (options.getIn([ 'parser', 'isDefault' ])) {
            /* eslint-disable no-console */
            console.error('no source format provided, using best fit...')
            /* eslint-enable no-console */

            let scores = this.detect(content)
            let best = {
                value: -1,
                key: null
            }

            Object.keys(scores).forEach(key => {
                if (scores[key] > best.value) {
                    best = {
                        value: scores[key],
                        key: key
                    }
                }
            })

            source = best.key
            /* eslint-disable no-console */
            console.error('best fit is', source)
            /* eslint-enable no-console */
        }
        else {
            source = options.getIn([ 'parser', 'name' ])
        }

        let target = options.getIn([ 'serializer', 'name' ])

        if (!parserMap[source]) {
            throw new Error('unrecognized source format')
        }

        if (!serializerMap[target]) {
            throw new Error('unrecognized target format')
        }

        let parser = new parserMap[source]()
        let serializer = new serializerMap[target]()
        let environment = new NodeEnvironment()
        let resolver = new ContextResolver(environment)

        let promise = parser.parse(item, options.get('parser'))

        if (typeof promise.then !== 'function') {
            let value = promise
            promise = new Promise((resolve) => {
                resolve(value)
            })
        }

        /* eslint-disable no-console */
        return promise.then(context => {
            return resolver.resolveAll(
                parser.item,
                context,
                options.get('resolver')
            ).then(_context => {
                try {
                    let final = serializer
                        .serialize(_context, options.get('serializer'))
                    callback(final)
                    return final
                }
                catch (e) {
                    console.error('@serializer threw error',
                        e,
                        e.stack,
                        JSON.stringify(e, null, '  ')
                    )
                    throw e
                }
            },
            error => {
                console.error('@resolver failed with error',
                    error,
                    error.stack,
                    JSON.stringify(error, null, '  ')
                )
                throw error
            }).catch(error => {
                console.error('@resolver caught error',
                    error,
                    error.stack,
                    JSON.stringify(error, null, '  ')
                )
                throw error
            })
        }, error => {
            console.error('@parser failed with error',
                error,
                error.stack,
                JSON.stringify(error)
            )
            throw error
        }).catch(err => {
            console.error('@parser caught error',
                err,
                err.stack,
                JSON.stringify(err)
            )
            throw err
        })
        /* eslint-enable no-console */
    }

    run(_input, _options, _callback) {
        if (this.useDetect) {
            let input = _input || this.input
            let options = _options || this.options

            let callback
            if (!callback) {
                callback = (data) => {
                    /* eslint-disable no-console */
                    console.log(data)
                    /* eslint-enable no-console */
                }
            }

            let content

            if (options.getIn([ 'resolver', 'base' ]) === 'local') {
                let _path = path.resolve('./', input)
                content = fs.readFileSync(_path).toString()
            }
            else {
                content = input
            }

            let scores = this.detect(content)
            callback(scores)
            return scores
        }
        else {
            return this.transform(_input, _options, _callback)
        }
    }
}
