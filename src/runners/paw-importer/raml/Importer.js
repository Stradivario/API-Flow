import { registerImporter } from '../../../mocks/PawShims'

import BaseImporter from '../../../serializers/paw/Serializer'
import RAMLParser from '../../../parsers/raml/Parser'

@registerImporter // eslint-disable-line
export default class RAMLImporter extends BaseImporter {
    static identifier = 'com.luckymarmot.PawExtensions.RAMLImporter';
    static title = 'RAML Importer';

    static fileExtensions = [];

    constructor() {
        super()
        this.parser = new RAMLParser()
        this.ENVIRONMENT_DOMAIN_NAME = 'RAML Environments'
    }

    canImport(context, items) {
        let hasRootFile = 0
        for (let item of items) {
            hasRootFile += this._startsWithRAMLVersion(item)
        }
        return hasRootFile > 0 ? 1 : 0
    }

    /*
        Only root files starts with RAML version.
    */
    _startsWithRAMLVersion(item) {
        return this.parser.detect(item.content)
    }

    /*
      @params:
        - context
        - items
        - options
    */
    createRequestContexts(context, items) {
        const parser = this.parser

        let reqPromises = []
        for (let item of items) {
            if (this._startsWithRAMLVersion(item)) {
                reqPromises.push(
                    parser.parse(item)
                        .then(reqContext => {
                            return {
                                context: reqContext,
                                items: [ item ]
                            }
                        })
                )
            }
        }
        return Promise.all(reqPromises)
    }
}
