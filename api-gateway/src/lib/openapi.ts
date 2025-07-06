import swaggerJsdoc from 'swagger-jsdoc'
import SwaggerParser from '@apidevtools/swagger-parser'

const baseSpec = (await SwaggerParser.dereference('src/openapi.yaml')) as any

const options = {
  definition: baseSpec,
  apis: ['src/routes/**/*.ts'],
}

const openapiSpec = swaggerJsdoc(options)

export default openapiSpec
