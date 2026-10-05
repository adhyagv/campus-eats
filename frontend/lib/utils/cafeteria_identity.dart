class CafeteriaIdentity {
  static String key(String? value) {
    final normalized = (value ?? '').trim().toLowerCase().replaceAll(
      RegExp(r'[^a-z0-9]'),
      '',
    );

    switch (normalized) {
      case 'bengaluru':
      case 'bengalurucafe':
      case 'maincafeteria':
        return 'bengaluru';
      case 'cafepesu':
      case 'pesucafe':
        return 'pesucafe';
      case 'nonveg':
      case 'nonvegcafeteria':
        return 'nonveg';
      default:
        return normalized;
    }
  }

  static String canonicalName(String? value) {
    switch (key(value)) {
      case 'bengaluru':
        return 'Bengaluru Cafe';
      case 'pesucafe':
        return 'Cafe PESU';
      case 'nonveg':
        return 'Non-Veg Cafeteria';
      default:
        return (value ?? '').trim();
    }
  }
}
