# Тестовая документация

`Teach — тестовая документация QA.docx` — test cases для junior QA: подготовка (build, вход, токен), smoke test нового build, 75 test cases по областям (вход и интро, «Сегодня», мастер, урок, разбор, повторы, справочники, голос, озвучка, настройки, устойчивость, API), шаблон bug report, что не считается bug, словарь.

Документ генерируется скриптом, чтобы правки делать в коде, а не в Word:

```bash
python3 -m venv .venv && .venv/bin/pip install python-docx
.venv/bin/python docs/qa/make_qa_doc.py
```
