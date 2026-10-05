import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/models/order_model.dart';

void main() {
  test('order model normalizes legacy and canonical statuses', () {
    expect(
      OrderModel.fromMap({'status': 'READY'}).status,
      'Ready',
    );
    expect(
      OrderModel.fromMap({'status': 'Ready for Pickup'}).status,
      'Ready',
    );
    expect(
      OrderModel.fromMap({'status': 'Completed'}).status,
      'Completed',
    );
  });
}
