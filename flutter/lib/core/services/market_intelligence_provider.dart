import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:iworkr_mobile/models/market_benchmark.dart';
import 'package:iworkr_mobile/models/market_trend.dart';

// ── Supabase client ────────────────────────────────────
SupabaseClient get _sb => Supabase.instance.client;

// ── Providers ──────────────────────────────────────────

/// Fetches the latest benchmark for a service category + region.
final marketBenchmarkProvider =
    FutureProvider.family<MarketBenchmark?, MarketQuery>((ref, query) async {
  try {
    final res = await _sb
        .from('market_benchmarks')
        .select()
        .eq('service_category', query.category)
        .eq('region_code', query.regionCode)
        .order('period_start', ascending: false)
        .limit(1)
        .maybeSingle();

    if (res == null) return _generateSimulatedBenchmark(query);
    return MarketBenchmark.fromJson(res);
  } catch (_) {
    return _generateSimulatedBenchmark(query);
  }
});

/// Fetches trends for a service category (last 6 months).
final marketTrendsProvider =
    FutureProvider.family<List<MarketTrend>, String>((ref, category) async {
  try {
    final res = await _sb
        .from('market_trends')
        .select()
        .eq('service_category', category)
        .order('period_start', ascending: true)
        .limit(6);

    if ((res as List).isEmpty) return _generateSimulatedTrends(category);
    return (res).map((e) => MarketTrend.fromJson(e)).toList();
  } catch (_) {
    return _generateSimulatedTrends(category);
  }
});

/// All available service categories (distinct from benchmarks).
final serviceCategoriesProvider = FutureProvider<List<String>>((ref) async {
  try {
    final res = await _sb
        .from('market_benchmarks')
        .select('service_category')
        .order('service_category');

    final categories = (res as List)
        .map((e) => e['service_category'] as String)
        .toSet()
        .toList();

    if (categories.isEmpty) return _defaultCategories;
    return categories;
  } catch (_) {
    return _defaultCategories;
  }
});

/// Latest benchmarks across all categories for the Index dashboard.
final allBenchmarksProvider = FutureProvider<List<MarketBenchmark>>((ref) async {
  try {
    final res = await _sb
        .from('market_benchmarks')
        .select()
        .order('updated_at', ascending: false)
        .limit(20);

    if ((res as List).isEmpty) return _generateAllSimulatedBenchmarks();
    return (res).map((e) => MarketBenchmark.fromJson(e)).toList();
  } catch (_) {
    return _generateAllSimulatedBenchmarks();
  }
});

// ── Query Model ────────────────────────────────────────

class MarketQuery {
  final String category;
  final String regionCode;

  const MarketQuery({required this.category, this.regionCode = 'default'});

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is MarketQuery &&
          category == other.category &&
          regionCode == other.regionCode;

  @override
  int get hashCode => category.hashCode ^ regionCode.hashCode;
}

// ── NLP Category Extraction ────────────────────────────

/// Extracts service category from a job title string using keyword matching.
String extractServiceCategory(String jobTitle) {
  final lower = jobTitle.toLowerCase();

  // HVAC
  if (_matchesAny(lower, ['hvac', 'air con', 'aircon', 'split system', 'ducted', 'a/c', 'heating', 'cooling', 'vrv', 'vrf'])) {
    if (_matchesAny(lower, ['install', 'fit', 'supply'])) return 'hvac_install';
    if (_matchesAny(lower, ['service', 'maintain'])) return 'hvac_service';
    return 'hvac_repair';
  }

  // Electrical
  if (_matchesAny(lower, ['electr', 'wiring', 'switchboard', 'circuit', 'power point', 'lighting', 'led', 'breaker', 'fuse'])) {
    if (_matchesAny(lower, ['install', 'fit', 'new'])) return 'electrical_install';
    return 'electrical_repair';
  }

  // Plumbing
  if (_matchesAny(lower, ['plumb', 'pipe', 'tap', 'faucet', 'leak', 'drain', 'toilet', 'hot water', 'hwu'])) {
    if (_matchesAny(lower, ['install', 'replace', 'new'])) return 'plumbing_install';
    return 'plumbing_repair';
  }

  // Security / CCTV
  if (_matchesAny(lower, ['cctv', 'camera', 'security', 'alarm', 'access control', 'intercom'])) {
    return 'security_install';
  }

  // Fire protection
  if (_matchesAny(lower, ['fire', 'extinguish', 'sprinkler', 'smoke detector'])) {
    return 'fire_protection';
  }

  // General maintenance
  if (_matchesAny(lower, ['maintain', 'service', 'inspection', 'check'])) {
    return 'general_maintenance';
  }

  return 'general_service';
}

bool _matchesAny(String input, List<String> keywords) {
  return keywords.any((k) => input.contains(k));
}

// ── Simulated Data (Demo Mode) ─────────────────────────

final _defaultCategories = [
  'hvac_install',
  'hvac_repair',
  'hvac_service',
  'electrical_install',
  'electrical_repair',
  'plumbing_install',
  'plumbing_repair',
  'security_install',
  'fire_protection',
  'general_maintenance',
  'general_service',
];

/// Human-friendly labels for categories
String categoryLabel(String category) {
  const labels = {
    'hvac_install': 'HVAC Install',
    'hvac_repair': 'HVAC Repair',
    'hvac_service': 'HVAC Service',
    'electrical_install': 'Electrical Install',
    'electrical_repair': 'Electrical Repair',
    'plumbing_install': 'Plumbing Install',
    'plumbing_repair': 'Plumbing Repair',
    'security_install': 'Security / CCTV',
    'fire_protection': 'Fire Protection',
    'general_maintenance': 'General Maintenance',
    'general_service': 'General Service',
  };
  return labels[category] ?? category.replaceAll('_', ' ');
}

/// Simulated pricing ranges per category (realistic AUD values)
final _simulatedRanges = {
  'hvac_install': (low: 1200.0, p25: 1800.0, med: 2500.0, p75: 3500.0, high: 5200.0, avg: 2650.0),
  'hvac_repair': (low: 120.0, p25: 250.0, med: 450.0, p75: 750.0, high: 1200.0, avg: 480.0),
  'hvac_service': (low: 80.0, p25: 150.0, med: 250.0, p75: 400.0, high: 650.0, avg: 270.0),
  'electrical_install': (low: 300.0, p25: 600.0, med: 1200.0, p75: 2200.0, high: 4000.0, avg: 1350.0),
  'electrical_repair': (low: 80.0, p25: 180.0, med: 350.0, p75: 600.0, high: 1000.0, avg: 370.0),
  'plumbing_install': (low: 200.0, p25: 500.0, med: 900.0, p75: 1500.0, high: 2800.0, avg: 980.0),
  'plumbing_repair': (low: 80.0, p25: 160.0, med: 300.0, p75: 500.0, high: 850.0, avg: 320.0),
  'security_install': (low: 500.0, p25: 1200.0, med: 2000.0, p75: 3500.0, high: 6000.0, avg: 2200.0),
  'fire_protection': (low: 150.0, p25: 350.0, med: 600.0, p75: 1000.0, high: 1800.0, avg: 650.0),
  'general_maintenance': (low: 60.0, p25: 120.0, med: 200.0, p75: 350.0, high: 600.0, avg: 220.0),
  'general_service': (low: 100.0, p25: 200.0, med: 400.0, p75: 700.0, high: 1200.0, avg: 430.0),
};

MarketBenchmark _generateSimulatedBenchmark(MarketQuery query) {
  final range = _simulatedRanges[query.category] ??
      _simulatedRanges['general_service']!;

  final now = DateTime.now();
  return MarketBenchmark(
    id: 'sim_${query.category}_${query.regionCode}',
    serviceCategory: query.category,
    regionCode: query.regionCode,
    period: 'monthly',
    periodStart: DateTime(now.year, now.month, 1),
    periodEnd: DateTime(now.year, now.month + 1, 0),
    sampleSize: 47,
    priceLow: range.low,
    priceP25: range.p25,
    priceMedian: range.med,
    priceP75: range.p75,
    priceHigh: range.high,
    priceAvg: range.avg,
    priceStddev: (range.high - range.low) / 4,
    winRateLow: 90,
    winRateMedian: 65,
    winRateHigh: 20,
    updatedAt: now,
  );
}

List<MarketBenchmark> _generateAllSimulatedBenchmarks() {
  return _simulatedRanges.entries.map((e) {
    return _generateSimulatedBenchmark(MarketQuery(category: e.key));
  }).toList();
}

List<MarketTrend> _generateSimulatedTrends(String category) {
  final range = _simulatedRanges[category] ?? _simulatedRanges['general_service']!;
  final now = DateTime.now();

  return List.generate(6, (i) {
    final monthOffset = 5 - i;
    final start = DateTime(now.year, now.month - monthOffset, 1);
    final end = DateTime(now.year, now.month - monthOffset + 1, 0);
    final drift = (i - 2) * (range.med * 0.03); // slight upward trend
    final changePct = i == 0 ? 0.0 : ((drift / range.med) * 100);

    return MarketTrend(
      id: 'sim_trend_${category}_$i',
      serviceCategory: category,
      regionCode: 'default',
      periodStart: start,
      periodEnd: end,
      avgPrice: range.avg + drift,
      medianPrice: range.med + drift,
      priceChangePct: changePct,
      volume: 30 + (i * 5),
      highPrice: range.high + drift,
      lowPrice: range.low + (drift * 0.5),
    );
  });
}

/// Submit a quote's pricing data to the market intelligence pool.
Future<void> submitPricingData({
  required String organizationId,
  String? quoteId,
  String? jobTitle,
  required String serviceCategory,
  String? serviceType,
  String? capacity,
  required double totalPrice,
  int lineItemCount = 1,
  String quoteStatus = 'draft',
}) async {
  try {
    await _sb.from('market_pricing_data').insert({
      'organization_id': organizationId,
      'quote_id': quoteId,
      'job_title': jobTitle,
      'service_category': serviceCategory,
      'service_type': serviceType,
      'capacity': capacity,
      'total_price': totalPrice,
      'line_item_count': lineItemCount,
      'quote_status': quoteStatus,
    });
  } catch (_) {
    // Silently fail — pricing data submission is non-critical
  }
}
