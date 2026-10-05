import 'package:flutter_test/flutter_test.dart';
import 'package:frontend/providers/menu_provider.dart';
import 'package:frontend/services/api_service.dart';

void main() {
  final records = [
    {
      '_id': 'bengaluru-1',
      'name': 'Masala Dosa',
      'price': 60,
      'description': 'Crispy dosa',
      'category': 'South Indian',
      'cafeteria': 'Bengaluru Cafe ',
      'available': true,
    },
    {
      '_id': 'pesu-1',
      'name': 'Veg Noodles',
      'price': 75,
      'description': 'Stir-fried noodles',
      'category': 'Chinese',
      'cafeteria': ' Cafe PESU',
      'available': true,
    },
    {
      '_id': 'nonveg-1',
      'name': 'Chicken Biryani',
      'price': 120,
      'description': 'Chicken rice',
      'category': 'Non-Veg',
      'cafeteria': 'Non-Veg Cafeteria',
      'available': true,
      'imageUrl': 'assets/images/food/chicken_biryani.jpg',
    },
    {
      '_id': 'nonveg-2',
      'name': 'Chicken 65',
      'price': 110,
      'description': 'Spiced chicken bites',
      'category': 'Non-Veg',
      'cafeteria': 'Nonveg',
      'available': false,
    },
  ];

  test('parses the backend success.data menu envelope', () {
    final parsed = ApiService.parseMenuResponse({
      'status': 'success',
      'data': records,
    });
    expect(parsed, hasLength(4));
    expect(
      () => ApiService.parseMenuResponse({'status': 'success', 'data': {}}),
      throwsFormatException,
    );
  });

  test('maps MongoDB availability, images and canonical cafeteria names', () {
    final bengaluru = MenuProvider.mapMenuItem(records[0]);
    final pesu = MenuProvider.mapMenuItem(records[1]);
    final nonVeg = MenuProvider.mapMenuItem(records[2]);
    final unavailable = MenuProvider.mapMenuItem(records[3]);

    expect(bengaluru.cafeteria, 'Bengaluru Cafe');
    expect(pesu.cafeteria, 'Cafe PESU');
    expect(nonVeg.cafeteria, 'Non-Veg Cafeteria');
    expect(nonVeg.imagePath, 'assets/images/food/chicken_biryani.jpg');
    expect(unavailable.isAvailable, isFalse);
  });

  test('cafeteria, All/category and search filters stay scoped together', () {
    final foods = records
        .map((record) => MenuProvider.mapMenuItem(record))
        .toList();

    expect(
      MenuProvider.filterFoods(
        foods,
        cafeteria: 'Cafe PESU',
      ).map((food) => food.name),
      ['Veg Noodles'],
    );
    expect(
      MenuProvider.filterFoods(
        foods,
        cafeteria: 'Non-Veg Cafeteria',
        category: 'Non Veg',
      ).map((food) => food.name),
      ['Chicken Biryani', 'Chicken 65'],
    );
    expect(
      MenuProvider.filterFoods(
        foods,
        cafeteria: 'Bengaluru Cafe',
        category: 'All',
        search: 'crispy',
      ).map((food) => food.name),
      ['Masala Dosa'],
    );
    expect(
      MenuProvider.filterFoods(
        foods,
        cafeteria: 'Non-Veg Cafeteria',
        availableOnly: true,
      ).map((food) => food.name),
      ['Chicken Biryani'],
    );
    expect(
      MenuProvider.filterFoods(
        foods,
        cafeteria: 'Cafe PESU',
        search: 'chicken',
      ),
      isEmpty,
    );
  });
}
