import { Router } from 'express'

const router = Router()

/**
 * @openapi
 * /hello:
 *   get:
 *     summary: Example hello endpoint
 *     responses:
 *       200:
 *         description: Returns greeting
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: hello
 */
router.get('/hello', (_req, res) => {
  res.json({ message: 'hello' })
})

export default router
