import assert from "node:assert/strict";
import test from "node:test";
import { safeAdminPath } from "./admin-allowlist.ts";
import {
  classifyCheckout,
  filterCustomers,
  filterOrders,
  formatChicago,
  groupCustomers,
  orderDetails,
  type CustomerOrder,
} from "./admin-orders.ts";
import { publicSitemapPaths } from "./sitemap-paths.ts";

function order(overrides: Partial<CustomerOrder> = {}): CustomerOrder {
  return {
    id: "cs_test",
    created: 1_700_000_000,
    customerName: "Ada Artist",
    customerEmail: "ada@example.com",
    totalCents: 4000,
    type: "playlist",
    typeLabel: "Guaranteed placement",
    itemSummary: "1× Playlist submission — guaranteed placement",
    shippingAddress: "",
    shippingRate: "",
    artistName: "Ada",
    trackUrl: "https://open.spotify.com/track/abc",
    details: [],
    ...overrides,
  };
}

test("classifies merch, playlist options, and payment-link feature verses", () => {
  assert.deepEqual(classifyCheckout({ metadata: { kind: "merch" } }), {
    type: "merch",
    typeLabel: "Merch",
  });
  assert.deepEqual(
    classifyCheckout({ metadata: { kind: "playlist", option: "listen" }, lineLabels: ["Playlist submission — listen and decide"] }),
    { type: "playlist", typeLabel: "Listen and decide" },
  );
  assert.deepEqual(
    classifyCheckout({ metadata: { kind: "playlist", option: "guaranteed" } }),
    { type: "playlist", typeLabel: "Guaranteed placement" },
  );
  assert.deepEqual(classifyCheckout({ paymentLinkId: "plink_123", lineLabels: ["16 bars"] }), {
    type: "feature-verse",
    typeLabel: "Feature verse",
  });
  assert.equal(classifyCheckout({ metadata: { kind: "merch" }, paymentLinkId: "plink_123" }).type, "merch");
  assert.equal(classifyCheckout({ mode: "subscription", metadata: { tier: "vip" } }).typeLabel, "VIP membership");
});

test("reads playlist metadata and payment-link custom fields", () => {
  const playlist = orderDetails({
    type: "playlist",
    metadata: {
      kind: "playlist",
      artistName: "Ada",
      trackUrl: "https://open.spotify.com/track/abc",
      email: "ada@example.com",
    },
  });
  assert.equal(playlist.artistName, "Ada");
  assert.equal(playlist.trackUrl, "https://open.spotify.com/track/abc");
  assert.equal(playlist.details.some((detail) => detail.label === "email"), false);

  const feature = orderDetails({
    type: "feature-verse",
    customFields: [
      { key: "artist", label: { custom: "Artist name" }, text: { value: "Nova" } },
      { key: "song", label: { custom: "Spotify link" }, text: { value: "https://open.spotify.com/track/xyz" } },
      { key: "note", label: { custom: "Note" }, text: { value: "javascript:alert(1)" } },
    ],
  });
  assert.equal(feature.details[0]?.label, "Artist name");
  assert.equal(feature.details[1]?.href, "https://open.spotify.com/track/xyz");
  assert.equal(feature.details[2]?.href, undefined);
  assert.equal(feature.trackUrl, "https://open.spotify.com/track/xyz");
});

test("filters by type and search, then groups customers", () => {
  const orders = [
    order({ id: "cs_1", created: 30, customerEmail: "ada@example.com", type: "playlist", typeLabel: "Listen and decide" }),
    order({
      id: "cs_2",
      created: 20,
      customerEmail: "Ada@Example.com",
      customerName: "Ada Artist",
      type: "merch",
      typeLabel: "Merch",
      itemSummary: "1× #Hero Tee, White (L)",
      totalCents: 2500,
    }),
    order({
      id: "cs_3",
      created: 10,
      customerEmail: "bo@example.com",
      customerName: "Bo",
      type: "feature-verse",
      typeLabel: "Feature verse",
      totalCents: 15000,
    }),
  ];

  assert.deepEqual(
    filterOrders(orders, "merch", "white").map((item) => item.id),
    ["cs_2"],
  );
  const customers = groupCustomers(orders);
  assert.equal(customers.length, 2);
  assert.equal(customers[0]?.email, "ada@example.com");
  assert.equal(customers[0]?.orderCount, 2);
  assert.equal(customers[0]?.totalCents, 6500);
  assert.equal(customers[0]?.orders[0]?.id, "cs_1");
  assert.deepEqual(
    filterCustomers(customers, "feature-verse", "").map((customer) => customer.email),
    ["bo@example.com"],
  );
});

test("formats timestamps in America/Chicago", () => {
  const winter = formatChicago(Math.floor(Date.UTC(2026, 0, 15, 18, 30) / 1000));
  assert.match(winter, /Jan 15, 2026/);
  assert.match(winter, /12:30/);
  assert.match(winter, /CST/);

  const summer = formatChicago(Math.floor(Date.UTC(2026, 6, 15, 18, 30) / 1000));
  assert.match(summer, /Jul 15, 2026/);
  assert.match(summer, /1:30/);
  assert.match(summer, /CDT/);
});

test("admin redirects stay on this site", () => {
  assert.equal(safeAdminPath("/admin/orders?type=playlist"), "/admin/orders?type=playlist");
  assert.equal(safeAdminPath("/admin/sign-in"), "/admin");
  assert.equal(safeAdminPath("//evil.example"), "/admin");
  assert.equal(safeAdminPath("https://evil.example/admin"), "/admin");
  assert.equal(safeAdminPath("/account"), "/admin");
  assert.equal(safeAdminPath("/admin/../account"), "/admin");
});

test("sitemap omits admin routes", () => {
  const paths = publicSitemapPaths();
  assert.equal(paths.some((path) => path === "/admin" || path.startsWith("/admin/")), false);
  assert.ok(paths.includes("/"));
  assert.ok(paths.includes("/playlist"));
  assert.ok(paths.includes("/merch"));
});
