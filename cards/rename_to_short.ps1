$sourceDir = "C:\Users\Admin\Documents\trae\WeChat\cards"

$mapping = @{
    # 权杖 Wands
    "wands_ace" = "w1"
    "wands_2" = "w2"
    "wands_3" = "w3"
    "wands_4" = "w4"
    "wands_5" = "w5"
    "wands_6" = "w6"
    "wands_7" = "w7"
    "wands_8" = "w8"
    "wands_9" = "w9"
    "wands_10" = "w10"
    "wands_page" = "w11"
    "wands_knight" = "w12"
    "wands_queen" = "w13"
    "wands_king" = "w14"
    # 圣杯 Cups
    "cups_ace" = "c1"
    "cups_2" = "c2"
    "cups_3" = "c3"
    "cups_4" = "c4"
    "cups_5" = "c5"
    "cups_6" = "c6"
    "cups_7" = "c7"
    "cups_8" = "c8"
    "cups_9" = "c9"
    "cups_10" = "c10"
    "cups_page" = "c11"
    "cups_knight" = "c12"
    "cups_queen" = "c13"
    "cups_king" = "c14"
    # 宝剑 Swords
    "swords_ace" = "s1"
    "swords_2" = "s2"
    "swords_3" = "s3"
    "swords_4" = "s4"
    "swords_5" = "s5"
    "swords_6" = "s6"
    "swords_7" = "s7"
    "swords_8" = "s8"
    "swords_9" = "s9"
    "swords_10" = "s10"
    "swords_page" = "s11"
    "swords_knight" = "s12"
    "swords_queen" = "s13"
    "swords_king" = "s14"
    # 星币 Pentacles
    "pentacles_ace" = "p1"
    "pentacles_2" = "p2"
    "pentacles_3" = "p3"
    "pentacles_4" = "p4"
    "pentacles_5" = "p5"
    "pentacles_6" = "p6"
    "pentacles_7" = "p7"
    "pentacles_8" = "p8"
    "pentacles_9" = "p9"
    "pentacles_10" = "p10"
    "pentacles_page" = "p11"
    "pentacles_knight" = "p12"
    "pentacles_queen" = "p13"
    "pentacles_king" = "p14"
}

foreach ($item in $mapping.GetEnumerator()) {
    $oldFile = Join-Path $sourceDir "$($item.Key).jpg"
    $newFile = Join-Path $sourceDir "$($item.Value).jpg"
    if (Test-Path $oldFile) {
        Rename-Item -Path $oldFile -NewName "$($item.Value).jpg" -Force
        Write-Host "Renamed: $($item.Key).jpg -> $($item.Value).jpg"
    } else {
        Write-Host "Not found: $oldFile"
    }
}

Write-Host "`nDone!"