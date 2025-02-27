const { Restaurant, Category, Comment, User } = require("../../models");
const { getOffset, getPagination } = require("../../helpers/pagination-helper");
const restaurantController = {
  getRestaurants: (req, res, next) => {
    const DEFAULT_LIMIT = 9;
    const categoryId = Number(req.query.categoryId) || ""; // 從網址上拿下來的參數是字串，先轉成 Number 再操作
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || DEFAULT_LIMIT;
    const offset = getOffset(limit, page);

    return Promise.all([
      Restaurant.findAndCountAll({
        include: Category,
        where: {
          // 新增查詢條件
          ...(categoryId ? { categoryId } : {}),
        },
        limit,
        offset,
        nest: true,
        raw: true,
      }),
      Category.findAll({ raw: true }),
    ])
      .then(([restaurants, categories]) => {
        const favoritedRestaurantsId =
          req.user && req.user.FavoritedRestaurants.map((fr) => fr.id);
        const likedRestaurantsId =
          req.user && req.user.LikedRestaurants.map((lr) => lr.id);
        const data = restaurants.rows.map((r) => ({
          ...r,
          description: r.description.substring(0, 50),
          isFavorited: favoritedRestaurantsId.includes(r.id),
          isLiked: likedRestaurantsId.includes(r.id),
        }));
        return res.render("restaurants", {
          restaurants: data,
          categories,
          categoryId,
          pagination: getPagination(limit, page, restaurants.count),
        });
      })
      .catch((err) => next(err));
  },
  getRestaurant: (req, res, next) => {
    return Restaurant.findByPk(req.params.id, {
      include: [
        Category,
        { model: Comment, include: User },
        { model: User, as: "FavoritedUsers" },
        { model: User, as: "LikedUsers" },
      ],
    })
      .then((restaurant) => {
        if (!restaurant) throw new Error("Restaurant didn't exist!");
        const isFavorited = restaurant.FavoritedUsers.some(
          (f) => f.id === req.user.id
        );
        const isLiked = restaurant.LikedUsers.some((l) => l.id === req.user.id);

        res.render("restaurant", {
          restaurant: restaurant.toJSON(),
          isFavorited,
          isLiked,
        });
        return restaurant.increment("viewsCounts");
      })
      .catch((err) => next(err));
  },
  getDashboard: (req, res, next) => {
    return Restaurant.findByPk(req.params.id, {
      include: [Category, Comment],
      nest: true,
    })
      .then((restaurant) => {
        if (!restaurant) throw new Error("Restaurant didn't exist!");
        res.render("dashboard", { restaurant: restaurant.toJSON() });
      })
      .catch((err) => next(err));
  },
  getFeeds: (req, res, next) => {
    return Promise.all([
      Restaurant.findAll({
        limit: 10,
        order: [["createdAt", "DESC"]],
        include: [Category],
        raw: true,
        nest: true,
      }),
      Comment.findAll({
        limit: 10,
        order: [["createdAt", "DESC"]],
        include: [User, Restaurant],
        raw: true,
        nest: true,
      }),
    ])
      .then(([restaurants, comments]) => {
        const data = restaurants.map((r) => ({
          ...r,
          description: r.description.substring(0, 50),
        }));
        res.render("feeds", {
          restaurants: data,
          comments,
        });
      })
      .catch((err) => next(err));
  },
  getTopRestaurants: (req, res, next) => {
    return Restaurant.findAll({
      include: [{ model: User, as: "FavoritedUsers" }],
    })
      .then((restaurants) => {
        const topRestaurants = restaurants
          .map((rest) => ({
            ...rest.toJSON(),
            description: rest.description.substring(0, 50),
            favoritedCount: rest.FavoritedUsers.length,
            isFavorited:
              req.user &&
              req.user.FavoritedRestaurants.some((f) => f.id === rest.id),
          }))
          .sort((a, b) => b.favoritedCount - a.favoritedCount)
          .slice(0, 10);
        res.render("top-restaurants", { restaurants: topRestaurants });
      })
      .catch((err) => next(err));
  },
};
module.exports = restaurantController;
