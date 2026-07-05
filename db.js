/**
 * ============================================================
 *  TERRY TENDER WEAR — DATABASE LAYER  (db.js)
 * ============================================================
 *  • Uses Supabase when credentials are configured
 *  • Falls back to LocalStorage when not configured
 *  • All methods return Promises — same API either way
 *  • Admin CRUD fully works with Supabase RLS v2 policies
 *  • Frontend reads synced in real-time from Supabase
 * ============================================================
 *
 *  SCRIPT LOAD ORDER (required on every page):
 *    1. <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *    2. <script src="supabase-config.js"></script>
 *    3. <script src="db.js"></script>
 *    4. <script src="cart.js"></script>
 *    5. <script src="app.js"></script>
 * ============================================================
 */

(function () {
  "use strict";

  /* ── Seed data for LocalStorage fallback ─────────────────── */
  var SEEDS = [
    { id:1, name:"Rosebud Onesie",       price:1200, category:"Onesies",   description:"Ultra-soft cotton onesie with a delicate rose print. Perfect for newborns.", image_url:"https://images.unsplash.com/photo-1522771930-78848d9293e8?w=500&h=500&auto=format&fit=crop&q=80", stock:25, is_new:true,  is_featured:true,  created_at:new Date().toISOString() },
    { id:2, name:"Sage Snuggle Set",     price:2400, category:"Sets",      description:"Two-piece matching set in calming sage green. Machine washable.",             image_url:"https://images.unsplash.com/photo-1519689680058-324335c77eba?w=500&h=500&auto=format&fit=crop&q=80", stock:15, is_new:true,  is_featured:false, created_at:new Date().toISOString() },
    { id:3, name:"Cloud Knit Romper",    price:1800, category:"Rompers",   description:"Lightweight knit romper with easy snap closure. Breathable and cosy.",        image_url:"https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=500&h=500&auto=format&fit=crop&q=80", stock:20, is_new:true,  is_featured:true,  created_at:new Date().toISOString() },
    { id:4, name:"Petal Soft Sleepsuit", price:1500, category:"Sleepwear", description:"Footed sleepsuit in brushed cotton. Keeps babies warm all night.",            image_url:"https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=500&h=500&auto=format&fit=crop&q=80", stock:30, is_new:false, is_featured:false, created_at:new Date().toISOString() },
    { id:5, name:"Linen Bloom Dress",    price:2100, category:"Dresses",   description:"Airy linen blend dress with flutter sleeves. Ideal for warm occasions.",     image_url:"https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=500&h=500&auto=format&fit=crop&q=80", stock:12, is_new:false, is_featured:true,  created_at:new Date().toISOString() },
    { id:6, name:"Warm Hug Cardigan",    price:1950, category:"Knitwear",  description:"Hand-knit style cardigan in warm ivory. Buttons at front for easy dressing.", image_url:"https://images.unsplash.com/photo-1543087903-1ac2ec7aa8c5?w=500&h=500&auto=format&fit=crop&q=80", stock:18, is_new:true,  is_featured:false, created_at:new Date().toISOString() },
  ];

  var LS_PRODUCTS = "ttw_products_v3";
  var LS_ORDERS   = "ttw_orders_v3";
  var LS_AUTH     = "ttw_admin_auth_v3";

  var PRODUCT_CACHE_KEY = "ttw_products_cache_v1";
  var PRODUCT_CACHE_TTL = 1000 * 60 * 5; // 5 minutes
  var _productCache = null;
  var _productCacheExpiry = 0;

  function loadProductCache() {
    if (_productCache && Date.now() < _productCacheExpiry) return _productCache;
    try {
      var payload = JSON.parse(sessionStorage.getItem(PRODUCT_CACHE_KEY) || "null");
      if (!payload || typeof payload !== "object" || !Array.isArray(payload.data) || typeof payload.ts !== "number") {
        sessionStorage.removeItem(PRODUCT_CACHE_KEY);
        return null;
      }
      if (Date.now() - payload.ts > PRODUCT_CACHE_TTL) {
        sessionStorage.removeItem(PRODUCT_CACHE_KEY);
        return null;
      }
      _productCache = payload.data;
      _productCacheExpiry = payload.ts + PRODUCT_CACHE_TTL;
      return _productCache;
    } catch (e) {
      return null;
    }
  }

  function saveProductCache(products) {
    _productCache = products;
    _productCacheExpiry = Date.now() + PRODUCT_CACHE_TTL;
    try {
      sessionStorage.setItem(PRODUCT_CACHE_KEY, JSON.stringify({
        ts: Date.now(),
        data: products,
      }));
    } catch (e) {}
  }

  /* ── Supabase client singleton ───────────────────────────── */
  var _client = null;

  function _getClient() {
    /* Return cached client */
    if (_client) return _client;

    var cfg = window.TERRY_CONFIG;
    if (!cfg || !cfg.configured) return null;

    /* Guard: Supabase SDK must be loaded */
    if (!window.supabase || typeof window.supabase.createClient !== "function") {
      console.error("TTW db.js: Supabase SDK not loaded yet. Check script order.");
      return null;
    }

    try {
      _client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
        auth: {
          persistSession:     true,
          autoRefreshToken:   true,
          detectSessionInUrl: false,
          storageKey:         "ttw_supabase_auth",
        },
      });
      window._sbClient = _client; /* expose for debugging */
      console.log("%c✅ Supabase client created", "color:#25D366;font-weight:bold");
      return _client;
    } catch (err) {
      console.error("TTW db.js: createClient failed →", err.message);
      return null;
    }
  }

  /* ── LocalStorage helpers ────────────────────────────────── */
  function lsGet(key, def) {
    try { var v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
    catch (e) { return def; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function lsNextId(arr) {
    if (!arr.length) return 1;
    return Math.max.apply(null, arr.map(function (x) { return Number(x.id) || 0; })) + 1;
  }
  function lsProducts() {
    var p = lsGet(LS_PRODUCTS, null);
    if (!p) { lsSet(LS_PRODUCTS, SEEDS); return SEEDS.slice(); }
    return p;
  }

  /* ── Format Supabase errors ──────────────────────────────── */
  function fmtErr(err) {
    if (!err) return new Error("Unknown error");
    var msg = err.message || err.details || err.hint || JSON.stringify(err);
    console.error("TTW Supabase error:", err);
    return new Error(msg);
  }

  /* ══════════════════════════════════════════════════════════
     PUBLIC DB API
     ══════════════════════════════════════════════════════════ */
  var DB = {

    isUsingSupabase: function () { return !!_getClient(); },

    /* ── READ ALL ──────────────────────────────────────────── */
    getAll: async function () {
      var sb = _getClient();
      if (sb) {
        var cached = loadProductCache();
        if (cached) return cached.slice();
        var r = await sb.from("products").select("*").order("created_at", { ascending: false });
        if (r.error) throw fmtErr(r.error);
        saveProductCache(r.data || []);
        return r.data || [];
      }
      return lsProducts();
    },

    getFeatured: async function () {
      var all = await DB.getAll();
      return all.filter(function (p) { return p.is_featured; });
    },

    getNewArrivals: async function () {
      var all = await DB.getAll();
      return all.filter(function (p) { return p.is_new; });
    },

    getById: async function (id) {
      var sb = _getClient();
      if (sb) {
        var cached = loadProductCache();
        if (cached) {
          var found = cached.find(function (p) { return String(p.id) === String(id); });
          if (found) return found;
        }
        var r = await sb.from("products").select("*").eq("id", id).maybeSingle();
        if (r.error) throw fmtErr(r.error);
        return r.data || null;
      }
      return lsProducts().find(function (p) { return String(p.id) === String(id); }) || null;
    },

    /* ── CREATE ────────────────────────────────────────────── */
    create: async function (data) {
      /* Strip auto-generated fields — Supabase creates them */
      var payload = Object.assign({}, data);
      delete payload.id;
      delete payload.created_at;

      var sb = _getClient();
      if (sb) {
        var r = await sb.from("products").insert(payload).select().single();
        if (r.error) throw fmtErr(r.error);
        return r.data;
      }
      /* LocalStorage */
      var products = lsProducts();
      var newProd  = Object.assign({}, payload, {
        id:         lsNextId(products),
        created_at: new Date().toISOString(),
      });
      products.unshift(newProd);
      lsSet(LS_PRODUCTS, products);
      return newProd;
    },

    /* ── UPDATE ────────────────────────────────────────────── */
    update: async function (id, changes) {
      var payload = Object.assign({}, changes);
      delete payload.id;
      delete payload.created_at;

      var sb = _getClient();
      if (sb) {
        var r = await sb.from("products").update(payload).eq("id", id).select().single();
        if (r.error) throw fmtErr(r.error);
        return r.data;
      }
      /* LocalStorage */
      var products = lsProducts().map(function (p) {
        return String(p.id) === String(id) ? Object.assign({}, p, payload) : p;
      });
      lsSet(LS_PRODUCTS, products);
      return products.find(function (p) { return String(p.id) === String(id); }) || null;
    },

    /* ── DELETE ────────────────────────────────────────────── */
    delete: async function (id) {
      var sb = _getClient();
      if (sb) {
        var r = await sb.from("products").delete().eq("id", id);
        if (r.error) throw fmtErr(r.error);
        return true;
      }
      lsSet(LS_PRODUCTS, lsProducts().filter(function (p) {
        return String(p.id) !== String(id);
      }));
      return true;
    },

    /* Reset to seed data (LocalStorage only) */
    resetToDefaults: function () {
      lsSet(LS_PRODUCTS, SEEDS);
      console.log("TTW: Catalogue reset to defaults (LocalStorage)");
    },

    /* ── STORAGE: Image upload ─────────────────────────────── */
    uploadProductImage: async function (file) {
      var sb = _getClient();
      if (!sb) {
        throw new Error("Supabase not configured. Cannot upload images in LocalStorage mode.");
      }

      if (!file || !file.type.startsWith("image/")) {
        throw new Error("Please select a valid image file.");
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error("Image too large. Maximum 10MB.");
      }

      var BUCKET = "product-images";
      var ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      var filename = "product-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;
      var path = "products/" + filename;

      try {
        var upload = await sb.storage.from(BUCKET).upload(path, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

        if (upload.error) {
          throw fmtErr(upload.error);
        }

        var pubResult = sb.storage.from(BUCKET).getPublicUrl(path);
        if (!pubResult.data || !pubResult.data.publicUrl) {
          throw new Error("Upload succeeded but could not get public URL. Is the bucket set to PUBLIC?");
        }

        console.log("%c✅ Image uploaded: " + pubResult.data.publicUrl, "color:#25D366;font-weight:bold");
        return pubResult.data.publicUrl;
      } catch (err) {
        console.error("TTW uploadProductImage error:", err);
        throw err;
      }
    },

    /* ── STORAGE: Setup instructions ───────────────────────── */
    getStorageSetupGuide: function () {
      return {
        bucket: "product-images",
        steps: [
          "1. Go to Supabase Dashboard → Storage",
          "2. Click 'New Bucket'",
          '3. Name it: "product-images"',
          "4. Toggle 'Make it public' ON ✅",
          "5. Create the bucket",
          "",
          "Then run this SQL in Supabase → SQL Editor:",
          "-- Allow anonymous users to upload images",
          "CREATE POLICY \"Public upload images\"",
          "  ON storage.objects FOR INSERT",
          "  TO anon, authenticated",
          "  WITH CHECK (bucket_id = 'product-images');",
          "",
          "-- Allow anyone to view images",
          "CREATE POLICY \"Public read images\"",
          "  ON storage.objects FOR SELECT",
          "  TO anon, authenticated",
          "  USING (bucket_id = 'product-images');",
        ],
      };
    },

    /* ── ORDERS ────────────────────────────────────────────── */
    saveOrder: async function (order) {
      var payload = {
        customer_name:  order.customer_name  || "",
        customer_phone: order.customer_phone || "",
        items:          order.items          || [],
        total:          order.total          || 0,
        status:         "pending",
        notes:          order.notes          || "",
      };

      var sb = _getClient();
      if (sb) {
        /* Uses anon key + public INSERT policy — works without login */
        var r = await sb.from("orders").insert(payload).select().single();
        if (r.error) {
          console.warn("TTW: Order log failed (non-fatal):", r.error.message);
          return null;
        }
        return r.data;
      }
      var orders  = lsGet(LS_ORDERS, []);
      var newOrder = Object.assign({}, payload, {
        id:         Date.now(),
        created_at: new Date().toISOString(),
      });
      orders.unshift(newOrder);
      lsSet(LS_ORDERS, orders);
      return newOrder;
    },

    getOrders: async function () {
      var sb = _getClient();
      if (sb) {
        var r = await sb.from("orders").select("*").order("created_at", { ascending: false });
        if (r.error) throw fmtErr(r.error);
        return r.data || [];
      }
      return lsGet(LS_ORDERS, []);
    },

    updateOrderStatus: async function (id, status) {
      var sb = _getClient();
      if (sb) {
        var r = await sb.from("orders").update({ status: status }).eq("id", id).select().single();
        if (r.error) throw fmtErr(r.error);
        return r.data;
      }
      var orders = lsGet(LS_ORDERS, []).map(function (o) {
        return String(o.id) === String(id) ? Object.assign({}, o, { status: status }) : o;
      });
      lsSet(LS_ORDERS, orders);
      return orders.find(function (o) { return String(o.id) === String(id); }) || null;
    },

    /* ── AUTH ──────────────────────────────────────────────── */

    /**
     * Login:
     *  - Supabase mode: uses Supabase Auth email+password
     *  - LocalStorage mode: checks against hardcoded password "terry2024"
     */
    adminLogin: async function (email, password) {
      var sb = _getClient();

      if (sb) {
        if (!email || !email.trim()) {
          throw new Error("Please enter your email address.");
        }
        if (!password || !password.trim()) {
          throw new Error("Please enter your password.");
        }

        var r = await sb.auth.signInWithPassword({
          email:    email.trim(),
          password: password.trim(),
        });

        if (r.error) {
          /* Make error messages user-friendly */
          var msg = r.error.message || "Login failed";
          if (msg.toLowerCase().includes("invalid")) {
            msg = "Wrong email or password. Check your Supabase Auth credentials.";
          }
          throw new Error(msg);
        }

        if (!r.data || !r.data.session) {
          throw new Error("Login failed — no session returned. Check your Supabase setup.");
        }

        console.log("%c✅ Admin logged in via Supabase", "color:#25D366;font-weight:bold");
        return r.data;
      }

      /* LocalStorage fallback */
      if (password === "terry2024") {
        lsSet(LS_AUTH, "true");
        return { user: { email: "admin@local" } };
      }
      throw new Error("Wrong password. Default password is: terry2024");
    },

    adminLogout: async function () {
      var sb = _getClient();
      if (sb) {
        await sb.auth.signOut();
      }
      localStorage.removeItem(LS_AUTH);
    },

    /**
     * Check if admin session is valid:
     *  - Supabase: checks live session (auto-refreshed)
     *  - LocalStorage: checks stored flag
     */
    isAdminLoggedIn: async function () {
      var sb = _getClient();
      if (sb) {
        try {
          var r = await sb.auth.getSession();
          return !!(r.data && r.data.session && r.data.session.user);
        } catch (e) {
          return false;
        }
      }
      return lsGet(LS_AUTH, null) === "true";
    },

    getAdminUser: async function () {
      var sb = _getClient();
      if (sb) {
        try {
          var r = await sb.auth.getUser();
          return (r.data && r.data.user) ? r.data.user : null;
        } catch (e) {
          return null;
        }
      }
      return { email: "Local Admin", id: "local" };
    },
  };

  /* Expose globally */
  window.DB = DB;

  /* Try to init client now (will silently skip if SDK not loaded yet) */
  /* Admin pages call _getClient() lazily after DOMContentLoaded */
  _getClient();

})();
