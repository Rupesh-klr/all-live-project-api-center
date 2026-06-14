const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')
const path = require('path')
const fs = require('fs')

function collectModuleApis() {
  const modulesDir = path.join(__dirname, '../modules')
  const apis = ['./src/routes/*.js']
  const entries = fs.readdirSync(modulesDir, { withFileTypes: true })
  for (const e of entries) {
    if (e.isDirectory()) apis.push(`./src/modules/${e.name}/*.js`)
  }
  return apis
}

function setupSwagger(app) {
  const options = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Portfolio Hub API',
        version: '1.0.0',
        description: 'Centralized API for all portfolio sub-modules',
        contact: { name: 'Support', email: 'support@yourdomain.com' },
      },
      servers: [{ url: `http://localhost:${process.env.PORT || 5000}`, description: 'Local' }],
      components: {
        securitySchemes: {
          bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        },
      },
      security: [{ bearerAuth: [] }],
    },
    apis: collectModuleApis(),
  }

  const spec = swaggerJsdoc(options)
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(spec, { explorer: true }))
}

module.exports = { setupSwagger }
