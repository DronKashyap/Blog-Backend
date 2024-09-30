import { PrismaClient } from '@prisma/client/edge'
import { withAccelerate } from '@prisma/extension-accelerate'
import { Hono } from 'hono'
import { sign, verify } from 'hono/jwt'
import { cors } from 'hono/cors'

// Create the main Hono app
const app = new Hono<{
  Bindings: {
    DATABASE_URL: string,
    JWT_SECRET: string,
  },
  Variables: {
    userId: any
  }
}>()

app.use('/*', cors())

// JWT Verification Middleware
app.use("/api/v1/blog/*", async (c, next) => {
  const authHeader = c.req.header('authorization') || ""
  console.log(`Authorization Header: ${authHeader}`);
  try {
    const token = authHeader.split(' ')[1]
    console.log(`Token: ${token}`)
    if (!token) {
      c.status(403)
      return c.json({ message: "You are not logged in" })
    }
    const payload = await verify(token, c.env.JWT_SECRET)
    console.log(`Payload: ${JSON.stringify(payload)}`);
    if (payload) {
      // Store userId in the context
      c.set('userId', payload.id)
      await next()
    } else {
      c.status(403)
      return c.json({ message: "You are not logged in" })
    }
  } catch (e) {
    c.status(403)
    return c.json({ message: "You are not logged in" })
  }
});

// Get / route 
app.get('/', (c) => {
  return c.text('Hi there! Backend is running.');
});


// Signup Route
app.post('/api/v1/signup', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate())

  const body = await c.req.json()
  console.log(body);
  try {
    const user = await prisma.user.create({
      data: {
        email: body.email,
        password: body.password
      }
    })
    const jwt = await sign({ id: user.id }, c.env.JWT_SECRET)
    return c.text(jwt)
  } catch (e) {
    console.error(e);
    c.status(403)
    return c.json({ error: "error while signing up" })
  }
})

// Signin Route
app.post('/api/v1/signin', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate())

  const body = await c.req.json()
  const user = await prisma.user.findUnique({
    where: {
      email: body.email
    }
  })

  if (!user) {
    c.status(403)
    return c.json({ error: "user not found" })
  }

  const jwt = await sign({ id: user.id }, c.env.JWT_SECRET)
  console.log(c.env.JWT_SECRET); 
  return c.text(jwt)
})

// Get Blog by ID Route
app.get('/api/v1/blog/:id', async (c) => {
  const id = c.req.param('id')
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate())

  try {
    const blog = await prisma.post.findUnique({
      where: { id }
    })
    if (!blog) {
      c.status(404)
      return c.json({ error: 'Blog not found' })
    }
    return c.json(blog)
  } catch (e) {
    c.status(500)
    return c.json({ error: 'Error retrieving blog' })
  }
})

// Create Blog Route
app.post('/api/v1/blog', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate())

  const body = await c.req.json()
  try {
    const blog = await prisma.post.create({
      data: {
        title: body.title,
        content: body.content,
        authorId: c.get('userId')
      }
    })
    return c.json(blog)
  } catch (e) {
    c.status(500)
    return c.json({ error: 'Error creating blog' })
  }
})

// Update Blog Route
app.put('/api/v1/blog', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate())

  const body = await c.req.json()
  try {
    const blog = await prisma.post.update({
      where: { id: body.id },
      data: {
        title: body.title,
        content: body.content
      }
    })
    return c.json(blog)
  } catch (e) {
    c.status(500)
    return c.json({ error: 'Error updating blog' })
  }
})

//Delete the blog 
app.delete('/api/v1/blog/:id', async (c) => {
  const prisma = new PrismaClient({
    datasourceUrl: c.env?.DATABASE_URL,
  }).$extends(withAccelerate())

  const id = c.req.param('id')
  try {
    // Attempt to delete the blog post by its ID
    const deletedBlog = await prisma.post.delete({
      where: { id }
    })
    return c.json(deletedBlog)
  } catch (e) {
    console.error('Error deleting blog:', e)
    c.status(500)
    return c.json({ error: 'Error deleting blog' })
  }
})

export default app
