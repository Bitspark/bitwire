use bitwire::{Payload, PublicError, Trace};

#[test]
fn missing_payload_is_not_json_null() {
    let absent = Payload::Absent;
    let null = Payload::from_json("null").unwrap();
    assert!(absent.is_absent());
    assert!(!null.is_absent());
    assert_eq!(null.raw(), Some("null"));
    assert!(serde_json::to_string(&absent).is_err());
    assert_eq!(serde_json::to_string(&null).unwrap(), "null");
}

#[test]
fn json_spelling_and_integer_precision_survive() {
    let raw = r#"{ "integer": 900719925474099312345, "exponent": 1.2300e+70 }"#;
    let payload = Payload::from_json(raw).unwrap();
    assert_eq!(payload.raw(), Some(raw));
    assert_eq!(serde_json::to_string(&payload).unwrap(), raw);
    assert_eq!(
        payload.value().unwrap()["integer"].to_string(),
        "900719925474099312345"
    );
    let decoded: Payload = serde_json::from_str(raw).unwrap();
    assert_eq!(decoded.raw(), Some(raw));
}

#[test]
fn every_json_string_must_contain_unicode_scalars() {
    for raw in [
        r#""\ud800""#,
        r#""\udfff""#,
        r#""\ud800\u0061""#,
        r#"{"same":"\ud800","same":"valid"}"#,
        r#"{"\ud800":"invalid key"}"#,
    ] {
        assert!(Payload::from_json(raw).is_err(), "accepted {raw}");
        assert!(
            serde_json::from_str::<Payload>(raw).is_err(),
            "accepted {raw}"
        );
    }
    for raw in [r#""\ud83d\ude00""#, r#""\\ud800""#, r#"["a/b", "", "é"]"#] {
        assert!(Payload::from_json(raw).is_ok(), "rejected {raw}");
    }
}

#[test]
fn admission_proof_never_crosses_the_profile_boundary() {
    let mut refusal = PublicError::new("busy", "capacity reached").unpublished();
    refusal.data = Payload::from_json(r#"{"capacity":0}"#).unwrap();
    assert!(refusal.is_unpublished());
    let encoded = serde_json::to_string(&refusal).unwrap();
    assert_eq!(
        encoded,
        r#"{"code":"busy","message":"capacity reached","data":{"capacity":0}}"#
    );
    let decoded: PublicError = serde_json::from_str(&encoded).unwrap();
    assert!(!decoded.is_unpublished());
    assert_eq!(decoded.data.raw(), refusal.data.raw());
    assert!(!refusal.without_unpublished_proof().is_unpublished());
}

#[test]
fn trace_fields_retain_their_original_spelling() {
    let trace = Trace {
        parent: Some("opaque incoming trace".into()),
        state: Some("vendor=value".into()),
    };
    let encoded = serde_json::to_string(&trace).unwrap();
    assert_eq!(
        encoded,
        r#"{"traceparent":"opaque incoming trace","tracestate":"vendor=value"}"#
    );
    assert_eq!(serde_json::to_string(&Trace::default()).unwrap(), "{}");
}
