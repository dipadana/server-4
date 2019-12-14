const Book = require('../Models/book')
const axios = require('../config/axios')
const Redis = require('ioredis')
const redis = new Redis()

class BookController {

  static async create(req, res, next) {
    const Books = await redis.get('Books')
    try {
      const { title, author, category, rating, price, stock, description } = req.body
      let image
      if (req.file) {
        image = req.file.cloudStoragePublicUrl
      } else {
        image = ''
      }
      const created = await Book.create({ title, author, category, rating, price, stock, description, image, idGoogle: null })
      if (Books) redis.del('Books')
      res.status(201).json(created)
    } catch (error) {
      next(error)
    }
  }

  static async findOne(req, res, next) {
    const dataBook = await redis.get(`Book-${req.params.bookId}`)
    if (dataBook) {
      res.status(200).json(JSON.parse(dataBook))
    } else {
      try {
        const { bookId: _id } = req.params
        const book = await Book.findOne({ _id })
        if (book.idGoogle) {
          const { data: detail } = await axios({
            url: `https://www.googleapis.com/books/v1/volumes/${book.idGoogle}?key=${process.env.GOOGLE_API_KEY}`
          })
          if (detail.volumeInfo.imageLinks.medium) {
            book.image = detail.volumeInfo.imageLinks.medium
            await redis.set(`Book-${_id}`, JSON.stringify(book))
            res.status(200).json(book)
          } else {
            book.image = "https://previews.123rf.com/images/hchjjl/hchjjl1504/hchjjl150402710/38564779-doodle-book-seamless-pattern-background.jpg"
            await redis.set(`Book-${_id}`, JSON.stringify(book))
            res.status(200).json(book)
          }
        } else {
          await redis.set(`Book-${_id}`, JSON.stringify(book))
          res.status(200).json(book)
        }
      } catch (error) {
        next(error)
      }
    }
  }

  static async findByTitle(req, res, next) {
    const dataBook = await redis.get(`Book-${req.query.title}`)
    if (dataBook) {
      res.status(200).json(JSON.parse(dataBook))
    } else {
      try {
        const { title } = req.query
        const found = await Book.find({ title: { $regex: `${title}`, $options: 'i' } })
        await redis.set(`Book-${title}`, JSON.stringify(found))
        res.status(200).json(found)
      } catch (error) {
        next(error)
      }
    }
  }

  static async findByAuthor(req, res, next) {
    const dataBook = await redis.get(`Books-${req.query.author}`)
    if (dataBook) {
      res.status(200).json(JSON.parse(dataBook))
    } else {
      try {
        const { author } = req.query
        const found = await Book.find({ author: { $regex: `${author}`, $options: 'i' } })
        await redis.set(`Books-${author}`, JSON.stringify(found))
        res.status(200).json(found)
      } catch (error) {
        next(error)
      }
    }
  }

  static async findByCategory(req, res, next) {
    const dataBook = await redis.get(`Books-${req.query.category}`)
    if (dataBook) {
      res.status(200).json(JSON.parse(dataBook))
    } else {
      try {
        const { category } = req.query
        const found = await Book.find({ category: `${category}` })
        await redis.set(`Books-${category}`, JSON.stringify(found))
        res.status(200).json(found)
      } catch (error) {
        next(error)
      }
    }
  }

  static async findAll(req, res, next) {
    const Books = await redis.get('Books')
    if (Books) {
      res.status(200).json(JSON.parse(Books))
    } else {
      try {
        const books = await Book.find({})
        await redis.set('Books', JSON.stringify(books))
        res.status(200).json(books)
      } catch (error) {
        next(error)
      }
    }
  }

  static async getAllCategories(req, res, next) {
    const Categories = await redis.get('allCategories')
    if (Categories) {
      res.status(200).json(JSON.parse(categories))
    } else {
      try {
        const tags = await Book.find({}).select('category')
        let categories = BookController.uniqueCategory(tags)
        await redis.set('allCategories', JSON.stringify(categories))
        res.status(200).json(categories)
      } catch (error) {
        next(error)
      }
    }
  }

  static uniqueCategory(tags) {
    let tagArr = []
    let result = []
    tags.forEach((tag) => {
      tag.category.forEach((allTag) => {
        tagArr.push(allTag)
      })
    })
    let eachTag = [...new Set(tagArr)]
    let obj = {}
    eachTag.forEach((tag) => {
      obj.category = tag
      result.push(obj)
      obj = {}
    })
    return result
  }

  static async remove(req, res, next) {
    const Books = await redis.get('Books')
    const Book_id = await redis.get(`Book-${req.params.bookId}`)
    const Books_title = await redis.get(`Book-${req.query.title}`)
    const Books_author = await redis.get(`Books-${req.query.author}`)
    const Books_category = await redis.get(`Books-${req.query.category}`)
    try {
      const { bookId: _id } = req.params
      const deleted = await Book.remove({ _id })
      if (Books) await redis.del('Books')
      if (Book_id) await redis.del(`Book-${req.params.bookId}`)
      if (Books_title) await redis.del(`Book-${req.query.title}`)
      if (Books_author) await redis.del(`Books-${req.query.author}`)
      if (Books_category) await redis.del(`Books-${req.query.category}`)
      res.status(200).json(deleted)
    } catch (error) {
      next(error)
    }
  }

  static async update(req, res, next) {
    const Books = await redis.get('Books')
    const Book_id = await redis.get(`Book-${req.params.bookId}`)
    const Books_title = await redis.get(`Book-${req.query.title}`)
    const Books_author = await redis.get(`Books-${req.query.author}`)
    const Books_category = await redis.get(`Books-${req.query.category}`)
    try {
      let { bookId } = req.params
      let arr = ['title', 'author', 'category', 'rating', 'price', 'stock', 'description']
      let fields = req.body
      let obj = {}
      arr.forEach((el) => {
        for (let key in fields) {
          if (key === el) {
            obj[key] = fields[key]
          }
        }
      })
      if (req.file) {
        let image = req.file.cloudStoragePublicUrl
        obj.image = image
        const updated = await Book.findOneAndUpdate({ _id: bookId }, obj, { runValidators: true, new: true })
        let message = 'Book updated!'
        if (Books) await redis.del('Books')
        if (Book_id) await redis.del(`Book-${req.params.bookId}`)
        if (Books_title) await redis.del(`Book-${req.query.title}`)
        if (Books_author) await redis.del(`Books-${req.query.author}`)
        if (Books_category) await redis.del(`Books-${req.query.category}`)
        res.status(201).json({ message, updated })
      } else {
        let image = await Book.findOne({ _id: bookId }).select('image')
        obj.image = image.image
        const updated = await Book.findOneAndUpdate({ _id: bookId }, obj, { runValidators: true, new: true })
        let message = 'Book updated!'
        if (Books) await redis.del('Books')
        if (Book_id) await redis.del(`Book-${req.params.bookId}`)
        if (Books_title) await redis.del(`Book-${req.query.title}`)
        if (Books_author) await redis.del(`Books-${req.query.author}`)
        if (Books_category) await redis.del(`Books-${req.query.category}`)
        res.status(201).json({ message, updated })
      }
    } catch (error) {
      next(error)
    }
  }

  static async seedingGoogle(req, res, next) {
    try {
      const { author } = req.body
      const search = author.replace(' ', '+')
      let temp = []
      const { data } = await axios({
        method: 'get',
        url: `https://www.googleapis.com/books/v1/volumes?q=inauthor:${search}&key=${process.env.GOOGLE_API_KEY}`
      })
      data.items.forEach((el, i) => {
        if (el.volumeInfo.language === 'en') {
          if (el.volumeInfo.description) {
            let obj = {}
            obj.idGoogle = el.id
            obj.title = el.volumeInfo.title
            obj.author = el.volumeInfo.authors
            obj.description = el.volumeInfo.description
            obj.category = el.volumeInfo.categories
            obj.rating = el.volumeInfo.averageRating
            if (el.saleInfo.saleability !== 'NOT_FOR_SALE') {
              obj.price = el.saleInfo.retailPrice.amount
            } else {
              obj.price = 100000
            }
            obj.stock = 20 - Math.floor(Math.random() * 5)
            if (el.volumeInfo.imageLinks) {
              obj.image = el.volumeInfo.imageLinks.thumbnail
            } else {
              obj.image = ''
            }
            temp.push(obj)
          }
        }
      })
      for (let key of temp) {
        const created = await Book.create({
          idGoogle: key.idGoogle,
          title: key.title,
          author: key.author,
          description: key.description,
          category: key.category,
          rating: key.rating,
          price: key.price,
          stock: key.stock,
          image: key.image
        })
      }
      res.status(201).json({ message: 'success seeding data, check DB' })
    } catch (error) {
      next(error)
    }
  }


  static async popular(req, res, next) {
    const Popular = await redis.get('Popular')
    if (Popular) {
      res.status(200).json(JSON.parse(Popular))
    } else {
      try {
        const sorted = await Book.find({}).sort({ rating: 'desc' }).limit(10)
        await redis.set('Popular', JSON.stringify(sorted))
        res.status(200).json(sorted)
      } catch (error) {
        next(error)
      }
    }
  }

}


module.exports = BookController