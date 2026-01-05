module.exports = {
    schema: "./src/db/schema.js",
    out: "./drizzle",
    dialect: 'sqlite',
    dbCredentials: {
        url: "./data/sqlite.db",
    },
};
