// Data Management using LocalStorage

const STORAGE_KEYS = {
    PRODUCTS: 'inventory_products',
    SALES: 'inventory_sales',
    TRANSACTIONS: 'inventory_transactions',
    SELLERS: 'inventory_sellers',
    BUSINESSES: 'inventory_businesses',
    ADMIN_USERS: 'inventory_admin_users'
};

// In-memory cache — eliminates redundant localStorage reads
const _cache = {
    products: null,
    transactions: null,
    sellers: null,
    businesses: null,
    adminUsers: null
};

function _read(key, cacheKey) {
    if (_cache[cacheKey] !== null) return _cache[cacheKey];
    const raw = localStorage.getItem(key);
    _cache[cacheKey] = raw ? JSON.parse(raw) : [];
    return _cache[cacheKey];
}

function _write(key, cacheKey, data) {
    _cache[cacheKey] = data;
    localStorage.setItem(key, JSON.stringify(data));
}

function _invalidate(cacheKey) {
    _cache[cacheKey] = null;
}

// Shared password generator (single source of truth)
function generatePassword(length = 12) {
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
    let pw = '';
    for (let i = 0; i < length; i++) pw += charset[Math.floor(Math.random() * charset.length)];
    return pw;
}

// Alias kept for backward compat
const generateTemporaryPassword = generatePassword;

// Initialize empty storage
function initializeData() {
    if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS))      localStorage.setItem(STORAGE_KEYS.PRODUCTS, '[]');
    if (!localStorage.getItem(STORAGE_KEYS.SALES))         localStorage.setItem(STORAGE_KEYS.SALES, '[]');
    if (!localStorage.getItem(STORAGE_KEYS.TRANSACTIONS))  localStorage.setItem(STORAGE_KEYS.TRANSACTIONS, '[]');
    if (!localStorage.getItem(STORAGE_KEYS.SELLERS))       localStorage.setItem(STORAGE_KEYS.SELLERS, '[]');
    if (!localStorage.getItem(STORAGE_KEYS.ADMIN_USERS))   localStorage.setItem(STORAGE_KEYS.ADMIN_USERS, '[]');
    if (!localStorage.getItem(STORAGE_KEYS.BUSINESSES))    localStorage.setItem(STORAGE_KEYS.BUSINESSES, '[]');
}

// ─── Products ────────────────────────────────────────────────────────────────

function getProducts(businessId = null) {
    const all = _read(STORAGE_KEYS.PRODUCTS, 'products');
    return businessId !== null ? all.filter(p => p.businessId === businessId) : all;
}

function saveProducts(products) {
    _write(STORAGE_KEYS.PRODUCTS, 'products', products);
}

function addProduct(product) {
    const products = getProducts();
    const newId = products.length > 0 ? products[products.length - 1].id + 1 : 1;
    const newProduct = { ...product, id: newId };
    products.push(newProduct);
    saveProducts(products);
    return newProduct;
}

function updateProduct(id, updatedProduct) {
    const products = getProducts();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
        products[index] = { ...products[index], ...updatedProduct, id };
        saveProducts(products);
        return products[index];
    }
    return null;
}

function deleteProduct(id) {
    saveProducts(getProducts().filter(p => p.id !== id));
}

function getProductById(id) {
    return getProducts().find(p => p.id === id);
}

function getProductBySku(sku) {
    const lower = sku.toLowerCase();
    return getProducts().find(p => p.sku.toLowerCase() === lower);
}

// ─── Transactions ─────────────────────────────────────────────────────────────

function getTransactions(businessId = null) {
    const all = _read(STORAGE_KEYS.TRANSACTIONS, 'transactions');
    return businessId !== null ? all.filter(t => t.businessId === businessId) : all;
}

function saveTransactions(transactions) {
    _write(STORAGE_KEYS.TRANSACTIONS, 'transactions', transactions);
}

function addTransaction(transaction) {
    const transactions = getTransactions();
    const newId = transactions.length > 0 ? transactions[0].id + 1 : 1;
    const newTransaction = { ...transaction, id: newId, businessId: transaction.businessId || null };
    transactions.unshift(newTransaction);
    saveTransactions(transactions);
    return newTransaction;
}

// ─── Sales stats ──────────────────────────────────────────────────────────────

function getSalesToday() {
    const today = new Date().toDateString();
    return getTransactions()
        .filter(t => new Date(t.date).toDateString() === today)
        .reduce((sum, t) => sum + t.total, 0);
}

function getSalesThisMonth() {
    const now = new Date();
    const m = now.getMonth(), y = now.getFullYear();
    return getTransactions()
        .filter(t => { const d = new Date(t.date); return d.getMonth() === m && d.getFullYear() === y; })
        .reduce((sum, t) => sum + t.total, 0);
}

function getTotalProducts() { return getProducts().length; }

function getLowStockProducts(threshold = 5) {
    return getProducts().filter(p => p.stock < threshold && p.stock > 0);
}

function getOutOfStockProducts() {
    return getProducts().filter(p => p.stock === 0);
}

function getRecentSales(limit = 5) {
    return getTransactions().slice(0, limit);
}

// ─── Stock ────────────────────────────────────────────────────────────────────

function updateStock(productId, quantityChange) {
    const product = getProductById(productId);
    if (product) {
        const newStock = product.stock + quantityChange;
        if (newStock >= 0) {
            updateProduct(productId, { stock: newStock });
            return true;
        }
    }
    return false;
}

// ─── Search / filter products ─────────────────────────────────────────────────

function searchProducts(query) {
    const lower = query.toLowerCase();
    return getProducts().filter(p =>
        p.name.toLowerCase().includes(lower) ||
        p.sku.toLowerCase().includes(lower) ||
        p.category.toLowerCase().includes(lower)
    );
}

function filterProducts(filters) {
    let products = getProducts();
    if (filters.category && filters.category !== 'all') products = products.filter(p => p.category === filters.category);
    if (filters.color    && filters.color    !== 'all') products = products.filter(p => p.color === filters.color);
    if (filters.size     && filters.size     !== 'all') products = products.filter(p => p.size === filters.size);
    if (filters.query) {
        const lower = filters.query.toLowerCase();
        products = products.filter(p => p.name.toLowerCase().includes(lower) || p.sku.toLowerCase().includes(lower));
    }
    return products;
}

function getCategories() { return [...new Set(getProducts().map(p => p.category))].sort(); }
function getColors()     { return [...new Set(getProducts().map(p => p.color))].sort(); }
function getSizes()      { return [...new Set(getProducts().map(p => p.size))].sort(); }

// ─── Sellers ──────────────────────────────────────────────────────────────────

function getSellers(businessId = null) {
    const all = _read(STORAGE_KEYS.SELLERS, 'sellers');
    return businessId !== null ? all.filter(s => s.businessId === businessId) : all;
}

function saveSellers(sellers) {
    _write(STORAGE_KEYS.SELLERS, 'sellers', sellers);
}

function addSeller(seller) {
    const sellers = getSellers();
    const newId = sellers.length > 0 ? sellers[sellers.length - 1].id + 1 : 1;
    const newSeller = { ...seller, id: newId, businessId: seller.businessId || null };
    sellers.push(newSeller);
    saveSellers(sellers);
    return newSeller;
}

function updateSeller(id, updatedSeller) {
    const sellers = getSellers();
    const index = sellers.findIndex(s => s.id === id);
    if (index !== -1) {
        sellers[index] = { ...sellers[index], ...updatedSeller, id };
        saveSellers(sellers);
        return sellers[index];
    }
    return null;
}

function deleteSeller(id) {
    saveSellers(getSellers().filter(s => s.id !== id));
}

function getSellerById(id) {
    return getSellers().find(s => s.id === id);
}

function getSellerByUsername(username) {
    const lower = username.toLowerCase();
    return getSellers().find(s => s.username.toLowerCase() === lower);
}

function getSellerByUsernameAndPassword(username, password) {
    const lower = username.toLowerCase();
    return getSellers().find(s => s.username.toLowerCase() === lower && s.password === password) || null;
}

function resetSellerPasswordData(sellerId) {
    const seller = getSellerById(sellerId);
    if (!seller) return null;
    const password = generatePassword();
    updateSeller(sellerId, { password });
    return password;
}

function getTotalSellers()  { return getSellers().length; }
function getActiveSellers() { return getSellers().filter(s => s.status === 'Active'); }

function getSellerPerformance(sellerId, allTransactions) {
    // Accept pre-fetched transactions to avoid redundant reads when called in a loop
    const transactions = allTransactions || getTransactions();
    const seller = getSellerById(sellerId);
    if (!seller) return { totalOrders: 0, totalSales: 0, totalProfit: 0, totalCommission: 0, averageOrderValue: 0, commissionPercentage: 0 };

    const sellerTx = transactions.filter(t => t.seller === seller.fullName);
    const totalOrders = sellerTx.length;
    const totalSales  = sellerTx.reduce((s, t) => s + t.total, 0);
    const totalProfit = sellerTx.reduce((s, t) => s + (t.profit || 0), 0);
    const commissionPercentage = seller.commissionPercentage || 0;
    const totalCommission = totalSales * (commissionPercentage / 100);
    const averageOrderValue = totalOrders > 0 ? totalSales / totalOrders : 0;

    return { totalOrders, totalSales, totalProfit, totalCommission, averageOrderValue, commissionPercentage };
}

function getAllSellersPerformance() {
    const sellers = getSellers();
    const transactions = getTransactions(); // single read for all sellers
    return sellers.map(seller => ({
        ...seller,
        performance: getSellerPerformance(seller.id, transactions)
    }));
}

function filterSellers(filters) {
    let sellers = getSellers();
    if (filters.status && filters.status !== 'all') sellers = sellers.filter(s => s.status === filters.status);
    if (filters.query) {
        const lower = filters.query.toLowerCase();
        sellers = sellers.filter(s =>
            s.fullName.toLowerCase().includes(lower) ||
            s.username.toLowerCase().includes(lower) ||
            s.email.toLowerCase().includes(lower)
        );
    }
    return sellers;
}

// ─── Businesses ───────────────────────────────────────────────────────────────

function getBusinesses() {
    return _read(STORAGE_KEYS.BUSINESSES, 'businesses');
}

function saveBusinesses(businesses) {
    _write(STORAGE_KEYS.BUSINESSES, 'businesses', businesses);
}

function addBusiness(business) {
    const businesses = getBusinesses();
    const newId = businesses.length > 0 ? businesses[businesses.length - 1].id + 1 : 1;
    const newBusiness = { ...business, id: newId, createdAt: new Date().toISOString() };
    businesses.push(newBusiness);
    saveBusinesses(businesses);
    return newBusiness;
}

function updateBusiness(id, updatedBusiness) {
    const businesses = getBusinesses();
    const index = businesses.findIndex(b => b.id === id);
    if (index !== -1) {
        businesses[index] = { ...businesses[index], ...updatedBusiness, id };
        saveBusinesses(businesses);
        return businesses[index];
    }
    return null;
}

function deleteBusiness(id) {
    saveBusinesses(getBusinesses().filter(b => b.id !== id));
}

function getBusinessById(id)     { return getBusinesses().find(b => b.id === id); }
function getBusinessByName(name) { const l = name.toLowerCase(); return getBusinesses().find(b => b.name.toLowerCase() === l); }

// ─── Admin Users ──────────────────────────────────────────────────────────────

function getAdminUsers() {
    return _read(STORAGE_KEYS.ADMIN_USERS, 'adminUsers');
}

function saveAdminUsers(adminUsers) {
    _write(STORAGE_KEYS.ADMIN_USERS, 'adminUsers', adminUsers);
}

function addAdminUser(adminUser) {
    const adminUsers = getAdminUsers();
    const newId = adminUsers.length > 0 ? adminUsers[adminUsers.length - 1].id + 1 : 1;
    const newAdminUser = { ...adminUser, id: newId, createdAt: new Date().toISOString() };
    adminUsers.push(newAdminUser);
    saveAdminUsers(adminUsers);
    return newAdminUser;
}

function updateAdminUser(id, updatedAdminUser) {
    const adminUsers = getAdminUsers();
    const index = adminUsers.findIndex(u => u.id === id);
    if (index !== -1) {
        adminUsers[index] = { ...adminUsers[index], ...updatedAdminUser, id };
        saveAdminUsers(adminUsers);
        return adminUsers[index];
    }
    return null;
}

function deleteAdminUser(id) {
    saveAdminUsers(getAdminUsers().filter(u => u.id !== id));
}

function getAdminUserById(id)     { return getAdminUsers().find(u => u.id === id); }
function getAdminUserByEmail(e)   { const l = e.toLowerCase(); return getAdminUsers().find(u => u.email.toLowerCase() === l); }
function getAdminUserByBusinessId(businessId) { return getAdminUsers().find(u => u.businessId === businessId); }

function getAdminUserByUsername(username) {
    const lower = username.toLowerCase();
    return getAdminUsers().find(u => u.username.toLowerCase() === lower);
}

function getAdminUserByUsernameAndPassword(username, password) {
    const adminUser = getAdminUserByUsername(username);
    if (!adminUser) return null;
    if (adminUser.status && adminUser.status !== 'Active') return null;
    if (adminUser.password !== password) return null;
    return adminUser;
}

// ─── Username generation ──────────────────────────────────────────────────────

function generateUsername(businessName) {
    const base = businessName.toLowerCase().replace(/[^a-z0-9]/g, '').substring(0, 15) || 'biz';
    return `${base}${Math.floor(Math.random() * 1000)}`;
}

// ─── Business creation ────────────────────────────────────────────────────────

function createAdminUserWithBusiness(businessName, adminFullName, email, phone) {
    const business = addBusiness({ name: businessName, status: 'Active' });
    const username = generateUsername(businessName);
    const temporaryPassword = generatePassword();

    const adminUser = addAdminUser({
        businessId: business.id,
        businessName,
        fullName: adminFullName,
        email,
        phone,
        username,
        password: temporaryPassword,
        role: 'Business Admin',
        status: 'Active'
    });

    return { business, adminUser, username, temporaryPassword };
}

function filterAdminUsers(filters) {
    let adminUsers = getAdminUsers();
    if (filters.status && filters.status !== 'all') adminUsers = adminUsers.filter(u => u.status === filters.status);
    if (filters.query) {
        const lower = filters.query.toLowerCase();
        adminUsers = adminUsers.filter(u =>
            u.businessName.toLowerCase().includes(lower) ||
            u.fullName.toLowerCase().includes(lower) ||
            u.username.toLowerCase().includes(lower) ||
            u.email.toLowerCase().includes(lower)
        );
    }
    return adminUsers;
}

// ─── Business profile / stats ─────────────────────────────────────────────────

function getBusinessProfile(businessId) {
    return {
        adminUser: getAdminUserByBusinessId(businessId),
        business: getBusinessById(businessId),
        stats: getBusinessStatistics(businessId),
        sellers: getSellers().filter(s => s.businessId === businessId)
    };
}

function getBusinessStatistics(businessId) {
    const products     = getProducts().filter(p => p.businessId === businessId);
    const transactions = getTransactions().filter(t => t.businessId === businessId);
    const sellers      = getSellers().filter(s => s.businessId === businessId);
    const totalSales   = transactions.reduce((s, t) => s + t.total, 0);
    const totalProfit  = transactions.reduce((s, t) => s + (t.profit || 0), 0);

    return {
        totalProducts: products.length,
        totalSales,
        totalProfit,
        totalOrders: transactions.length,
        totalSellers: sellers.length,
        activeSellers: sellers.filter(s => s.status === 'Active').length
    };
}

// Initialize data on load
initializeData();
