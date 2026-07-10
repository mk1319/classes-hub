import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../data/tests_repository.dart';
import '../domain/models.dart';

/// Loads the test + starts (or resumes) an attempt, then presents the questions.
/// Each chosen answer is persisted locally immediately (crash/offline-safe);
/// submit sends them all and shows the result if the test reveals results.
class AttemptScreen extends ConsumerStatefulWidget {
  const AttemptScreen({required this.testId, super.key});
  final int testId;

  @override
  ConsumerState<AttemptScreen> createState() => _AttemptScreenState();
}

class _AttemptScreenState extends ConsumerState<AttemptScreen> {
  TestDetail? _test;
  int? _attemptId;
  final Map<int, Object?> _answers = {};
  bool _loading = true;
  bool _submitting = false;
  String? _error;
  Map<String, dynamic>? _result;

  @override
  void initState() {
    super.initState();
    _init();
  }

  Future<void> _init() async {
    final repo = ref.read(testsRepositoryProvider);
    try {
      final test = await repo.getTest(widget.testId);
      final attemptId = await repo.startAttempt(widget.testId);
      setState(() {
        _test = test;
        _attemptId = attemptId;
        _loading = false;
      });
    } catch (e) {
      setState(() {
        _error = 'Could not start the test. Check your connection.';
        _loading = false;
      });
    }
  }

  Future<void> _choose(int questionId, Object? answer) async {
    setState(() => _answers[questionId] = answer);
    // Persist immediately so progress survives a drop/crash.
    await ref.read(testsRepositoryProvider).saveAnswerLocally(_attemptId!, questionId, answer);
  }

  Future<void> _submit() async {
    setState(() => _submitting = true);
    try {
      await ref.read(testsRepositoryProvider).submitAttempt(_attemptId!);
      final result = await ref.read(testsRepositoryProvider).getResult(_attemptId!);
      setState(() {
        _submitting = false;
        _result = result;
      });
    } catch (e) {
      // Answers remain queued; the sync worker will retry the submit on reconnect.
      setState(() {
        _submitting = false;
        _error = 'Saved offline — will submit automatically when back online.';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(_test?.title ?? 'Test')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null && _test == null
              ? Center(child: Text(_error!, textAlign: TextAlign.center))
              : _result != null
                  ? _ResultView(result: _result!)
                  : _buildQuestions(),
    );
  }

  Widget _buildQuestions() {
    final questions = _test!.questions;
    return Column(
      children: [
        if (_error != null)
          Container(
            width: double.infinity,
            color: Colors.amber.withOpacity(0.15),
            padding: const EdgeInsets.all(8),
            child: Text(_error!, textAlign: TextAlign.center),
          ),
        Expanded(
          child: ListView.builder(
            padding: const EdgeInsets.all(16),
            itemCount: questions.length,
            itemBuilder: (_, i) => _QuestionCard(
              index: i + 1,
              question: questions[i],
              selected: _answers[questions[i].id],
              onChoose: (a) => _choose(questions[i].id, a),
            ),
          ),
        ),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: FilledButton(
              onPressed: _submitting ? null : _submit,
              child: Text(_submitting ? 'Submitting…' : 'Submit test'),
            ),
          ),
        ),
      ],
    );
  }
}

class _QuestionCard extends StatelessWidget {
  const _QuestionCard({required this.index, required this.question, required this.selected, required this.onChoose});
  final int index;
  final TestQuestion question;
  final Object? selected;
  final void Function(Object?) onChoose;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('$index. ${question.body}', style: Theme.of(context).textTheme.titleSmall),
            const SizedBox(height: 8),
            if (question.type == 'text')
              TextField(
                minLines: 2,
                maxLines: 5,
                decoration: const InputDecoration(hintText: 'Your answer'),
                onChanged: onChoose,
              )
            else if (question.type == 'mcq_multi')
              ...question.options.map((o) {
                final set = (selected as List?)?.cast<String>() ?? const <String>[];
                return CheckboxListTile(
                  dense: true,
                  value: set.contains(o.id),
                  title: Text(o.text),
                  onChanged: (v) {
                    final next = [...set];
                    v == true ? next.add(o.id) : next.remove(o.id);
                    onChoose(next);
                  },
                );
              })
            else
              ...question.options.map((o) => RadioListTile<String>(
                    dense: true,
                    value: o.id,
                    groupValue: selected as String?,
                    title: Text(o.text),
                    onChanged: (v) => onChoose(v),
                  )),
          ],
        ),
      ),
    );
  }
}

class _ResultView extends StatelessWidget {
  const _ResultView({required this.result});
  final Map<String, dynamic> result;

  @override
  Widget build(BuildContext context) {
    final revealed = result['revealed'] == true;
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(revealed ? Icons.check_circle : Icons.hourglass_bottom, size: 56, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 16),
            Text(
              revealed
                  ? 'Score: ${result['score']}'
                  : 'Submitted! Your teacher will publish results.',
              style: Theme.of(context).textTheme.titleMedium,
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }
}
