use bip39::Language;
use unicode_normalization::UnicodeNormalization;

use crate::Result;

pub fn normalize_nfkd(input: &str) -> String {
    input
        .trim()
        .nfkd()
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

pub fn mnemonic_ja2en(mnemonic_ja: &str) -> Result<String> {
    map_mnemonic_by_word_id(mnemonic_ja, Language::Japanese, Language::English)
}

pub fn mnemonic_en2ja(mnemonic_en: &str) -> Result<String> {
    map_mnemonic_by_word_id(mnemonic_en, Language::English, Language::Japanese)
}

fn map_mnemonic_by_word_id(input: &str, src: Language, dst: Language) -> Result<String> {
    let normalized = normalize_nfkd(input);
    let mapped = normalized
        .split(' ')
        .map(|word| {
            let idx = src.find_word(word);
            let idx = match idx {
                Some(i) => i,
                None => {
                    return Err(
                        format!("word '{}' not found in source language wordlist", word).into(),
                    )
                }
            };
            Ok(dst.word_list()[idx as usize])
        })
        .collect::<Result<Vec<_>>>()?;

    Ok(mapped.join(" "))
}
