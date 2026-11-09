from pathlib import Path


def test_api_mutations_do_not_open_nested_request_transactions():
    main_py = Path(__file__).parents[1] / "app" / "main.py"
    assert "with session.begin()" not in main_py.read_text()


def test_bootstrap_client_sends_json_body_instead_of_query_credentials():
    api_js = Path(__file__).parents[2] / "frontend" / "js" / "api.js"
    source = api_js.read_text()
    assert "body: JSON.stringify({ email, password })" in source
    assert "/auth/bootstrap?email=" not in source
