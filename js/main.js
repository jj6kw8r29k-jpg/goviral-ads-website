/* GoViral Ads — shared interactions */
(function () {
  "use strict";

  var SUPABASE_URL = "https://hmkyhwpuxtcfltthdggf.supabase.co";
  var SUPABASE_KEY = "sb_publishable_rMf-feebp3uAKvQYHMmN6w_EnVwrkOx";

  /* ---------- Mobile nav ---------- */
  var burger = document.querySelector(".nav__burger");
  if (burger) {
    burger.addEventListener("click", function () {
      document.body.classList.toggle("nav-open");
    });
  }

  /* ---------- Scroll reveal ---------- */
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("is-in");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0, rootMargin: "0px 0px -60px 0px" }
  );
  document.querySelectorAll(".reveal, .reveal-stagger").forEach(function (el) {
    io.observe(el);
  });

  /* ---------- Manifesto line-by-line light-up ---------- */
  var lio = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) e.target.classList.add("is-lit");
        else e.target.classList.remove("is-lit");
      });
    },
    { threshold: 0.9 }
  );
  document.querySelectorAll(".manifesto .line").forEach(function (el) {
    lio.observe(el);
  });

  /* ---------- Counter count-up ---------- */
  function animateCount(el) {
    var raw = el.getAttribute("data-count");
    var target = parseFloat(raw);
    var decimals = (raw.split(".")[1] || "").length;
    var prefix = el.getAttribute("data-prefix") || "";
    var suffix = el.getAttribute("data-suffix") || "";
    var dur = 1600;
    var start = null;
    function frame(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      var val = (target * eased).toFixed(decimals);
      el.textContent = prefix + Number(val).toLocaleString(undefined, { minimumFractionDigits: decimals }) + suffix;
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }
  var cio = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          animateCount(e.target);
          cio.unobserve(e.target);
        }
      });
    },
    { threshold: 0.5 }
  );
  document.querySelectorAll("[data-count]").forEach(function (el) {
    cio.observe(el);
  });

  /* ---------- Accordions (services + FAQ) ---------- */
  function bindAccordion(itemSel, headSel, bodySel) {
    document.querySelectorAll(itemSel).forEach(function (item) {
      var head = item.querySelector(headSel);
      var body = item.querySelector(bodySel);
      if (!head || !body) return;
      head.addEventListener("click", function () {
        var open = item.classList.contains("is-open");
        if (open) {
          body.style.maxHeight = "0px";
          item.classList.remove("is-open");
        } else {
          body.style.maxHeight = body.scrollHeight + "px";
          item.classList.add("is-open");
        }
      });
    });
  }
  bindAccordion(".svc", ".svc__head", ".svc__body");
  bindAccordion(".faq__item", ".faq__q", ".faq__a");

  /* ---------- 3D tilt on [data-tilt] ---------- */
  var fine = window.matchMedia("(pointer: fine)").matches;
  var noMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (fine && !noMotion) {
    document.querySelectorAll("[data-tilt]").forEach(function (el) {
      var max = parseFloat(el.getAttribute("data-tilt")) || 6;
      el.style.transition = "transform 0.18s ease";
      el.addEventListener("mousemove", function (ev) {
        var r = el.getBoundingClientRect();
        var x = (ev.clientX - r.left) / r.width - 0.5;
        var y = (ev.clientY - r.top) / r.height - 0.5;
        el.style.transform =
          "perspective(900px) rotateY(" + (x * max).toFixed(2) + "deg) rotateX(" + (-y * max).toFixed(2) + "deg) translateZ(0)";
      });
      el.addEventListener("mouseleave", function () {
        el.style.transform = "perspective(900px) rotateY(0deg) rotateX(0deg)";
      });
    });
  }

  /* ---------- Sticky CTA (landing pages) ---------- */
  var sticky = document.querySelector(".sticky-cta");
  if (sticky) {
    var hero = document.querySelector(".hero");
    window.addEventListener(
      "scroll",
      function () {
        var past = hero ? window.scrollY > hero.offsetHeight : window.scrollY > 700;
        var nearEnd =
          window.innerHeight + window.scrollY > document.body.scrollHeight - 900;
        sticky.classList.toggle("is-visible", past && !nearEnd);
      },
      { passive: true }
    );
  }

  /* ---------- Lead forms → Supabase ---------- */
  document.querySelectorAll("form[data-lead-form]").forEach(function (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var btn = form.querySelector("[type=submit]");
      var msg = form.querySelector(".form-msg");
      var fd = new FormData(form);
      var params = new URLSearchParams(window.location.search);
      var payload = {
        name: fd.get("name"),
        email: fd.get("email"),
        phone: fd.get("phone") || null,
        company: fd.get("company") || null,
        website: fd.get("website") || null,
        monthly_ad_spend: fd.get("monthly_ad_spend") || null,
        service: fd.get("service") || form.getAttribute("data-service") || null,
        message: fd.get("message") || null,
        source_page: window.location.pathname,
        utm_source: params.get("utm_source"),
        utm_medium: params.get("utm_medium"),
        utm_campaign: params.get("utm_campaign")
      };
      var original = btn.textContent;
      btn.disabled = true;
      btn.textContent = "Sending…";
      fetch(SUPABASE_URL + "/rest/v1/leads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY,
          Prefer: "return=minimal"
        },
        body: JSON.stringify(payload)
      })
        .then(function (res) {
          if (!res.ok) throw new Error("Request failed: " + res.status);
          form.reset();
          if (msg) {
            msg.textContent = "✓ Received. We'll get back to you within one business day.";
            msg.className = "form-msg is-ok";
          }
          if (typeof gtag === "function") {
            gtag("event", "conversion", {
              send_to: "AW-17583065677/iq46CIjZhZ4bEM2UocBB",
              value: 1.0,
              currency: "INR"
            });
          }
          if (typeof rdt === "function") {
            rdt("track", "SignUp");
          }
        })
        .catch(function () {
          if (msg) {
            msg.textContent = "✕ Something went wrong. Please email hello@goviralads.agency instead.";
            msg.className = "form-msg is-err";
          }
        })
        .finally(function () {
          btn.disabled = false;
          btn.textContent = original;
        });
    });
  });

  /* ---------- Footer year ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });
})();
