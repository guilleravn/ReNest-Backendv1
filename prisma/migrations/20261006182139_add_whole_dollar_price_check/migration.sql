-- Hand-written: prices are whole US dollars (the create form takes integer dollars), so cents must
-- be a multiple of 100. See docs/rules/business-invariants.md.
ALTER TABLE "listings" ADD CONSTRAINT "listings_price_cents_whole_dollars_check" CHECK ("price_cents" % 100 = 0);
