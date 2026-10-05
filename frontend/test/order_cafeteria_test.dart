import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/providers/order_provider.dart';

void main() {
  test('legacy PESU cafeteria names match the canonical PESU assignment', () {
    final provider = OrderProvider();
    final order = {
      'cafeteria': 'Cafe PESU',
      'items': [
        {'cafeteria': 'PESU Cafe'},
      ],
    };

    expect(
      provider.matchesCafeteria(order, name: 'PESU Cafe', id: 'pesucafe'),
      isTrue,
    );
    expect(
      provider.matchesCafeteria(order, name: 'Bengaluru Cafe', id: 'bengaluru'),
      isFalse,
    );
  });
}
