class Batch {
  Batch({required this.id, required this.name, required this.showProgress});
  final int id;
  final String name;
  final bool showProgress;

  factory Batch.fromJson(Map<String, dynamic> j) => Batch(
        id: j['id'] as int,
        name: j['name'] as String? ?? 'Batch ${j['id']}',
        showProgress: j['show_progress_to_students'] as bool? ?? false,
      );
}

class Session {
  Session({
    required this.id,
    required this.title,
    required this.date,
    required this.start,
    required this.end,
  });
  final int id;
  final String? title;
  final String date;
  final String start;
  final String end;

  factory Session.fromJson(Map<String, dynamic> j) => Session(
        id: j['id'] as int,
        title: j['title'] as String?,
        date: j['session_date'] as String,
        start: (j['start_time'] as String).substring(0, 5),
        end: (j['end_time'] as String).substring(0, 5),
      );
}
