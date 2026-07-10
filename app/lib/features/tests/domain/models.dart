class TestSummary {
  TestSummary({required this.id, required this.title, required this.revealResults});
  final int id;
  final String title;
  final bool revealResults;

  factory TestSummary.fromJson(Map<String, dynamic> j) => TestSummary(
        id: j['id'] as int,
        title: j['title'] as String,
        revealResults: j['reveal_results'] as bool? ?? true,
      );
}

class TestQuestion {
  TestQuestion({required this.id, required this.type, required this.body, required this.options});
  final int id;
  final String type;
  final String body;
  final List<({String id, String text})> options;

  factory TestQuestion.fromJson(Map<String, dynamic> j) => TestQuestion(
        id: j['id'] as int,
        type: j['type'] as String,
        body: j['body'] as String,
        options: ((j['options'] as List?) ?? [])
            .map((o) => (id: (o as Map)['id'] as String, text: o['text'] as String))
            .toList(),
      );
}

class TestDetail {
  TestDetail({required this.id, required this.title, required this.questions});
  final int id;
  final String title;
  final List<TestQuestion> questions;

  factory TestDetail.fromJson(Map<String, dynamic> j) => TestDetail(
        id: j['id'] as int,
        title: j['title'] as String,
        questions: ((j['questions'] as List?) ?? [])
            .map((q) => TestQuestion.fromJson(q as Map<String, dynamic>))
            .toList(),
      );
}
