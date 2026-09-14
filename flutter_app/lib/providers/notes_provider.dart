import 'package:flutter/material.dart';
import '../models/quick_note.dart';
import '../services/api_service.dart';

class NotesProvider extends ChangeNotifier {
  List<QuickNote> _notes = [];
  bool _isLoading = false;
  String _selectedCategory = 'Todas';

  List<QuickNote> get notes => _notes;
  bool get isLoading => _isLoading;
  String get selectedCategory => _selectedCategory;

  List<String> get categories {
    final set = {'Todas'};
    for (final n in _notes) {
      if (n.category.isNotEmpty) set.add(n.category);
    }
    return set.toList();
  }

  List<QuickNote> get filteredNotes {
    if (_selectedCategory == 'Todas') return _notes;
    return _notes.where((n) => n.category == _selectedCategory).toList();
  }

  Future<void> loadNotes() async {
    _isLoading = true;
    notifyListeners();

    _notes = await ApiService.getNotes();
    _isLoading = false;
    notifyListeners();
  }

  void setCategory(String category) {
    _selectedCategory = category;
    notifyListeners();
  }

  Future<void> addNote(String title, String content, String category) async {
    final note = await ApiService.createNote(title, content, category);
    if (note != null) {
      _notes.insert(0, note);
      notifyListeners();
    }
  }

  Future<void> removeNote(String id) async {
    final success = await ApiService.deleteNote(id);
    if (success) {
      _notes.removeWhere((n) => n.id == id);
      notifyListeners();
    }
  }
}
