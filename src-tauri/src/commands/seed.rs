use crate::AppState;
use tauri::State;

/// Insert realistic French-friendly demo data into all tables.
/// Wrapped in a transaction for atomicity.
#[tauri::command]
pub async fn seed_demo_data(state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db();
    let pool = db.pool();

    let mut tx = pool.begin().await.map_err(|e| e.to_string())?;

    // ========================================================================
    // Libraries (2)
    // ========================================================================
    sqlx::query(
        "INSERT INTO libraries (name, path, type, is_online, total_files, total_size, notes)
         VALUES
         ('Disque Principal', 'D:\\Media\\Films', 'hdd', 1, 142, 1048576000, 'Disque interne principal'),
         ('NAS Media', '\\\\nas-salon\\video', 'nas', 1, 87, 524288000, 'Synology DS920+')"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Libraries: {}", e))?;

    // ========================================================================
    // Genres (8)
    // ========================================================================
    sqlx::query(
        "INSERT INTO genres (name) VALUES
         ('Action'), ('Comédie'), ('Drame'), ('Science-Fiction'),
         ('Thriller'), ('Animation'), ('Horreur'), ('Aventure')"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Genres: {}", e))?;

    // ========================================================================
    // Studios (6)
    // ========================================================================
    sqlx::query(
        "INSERT INTO studios (name, country) VALUES
         ('Warner Bros', 'US'),
         ('Universal Pictures', 'US'),
         ('Paramount Pictures', 'US'),
         ('Walt Disney Studios', 'US'),
         ('20th Century Studios', 'US'),
         ('Studio Ghibli', 'JP')"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Studios: {}", e))?;

    // ========================================================================
    // People (10)
    // ========================================================================
    sqlx::query(
        "INSERT INTO people (name, sort_name, primary_role, birth_date, birth_place) VALUES
         ('Jean Dujardin', 'Dujardin, Jean', 'Acting', '1972-06-19', 'Rueil-Malmaison, France'),
         ('Marion Cotillard', 'Cotillard, Marion', 'Acting', '1975-09-30', 'Paris, France'),
         ('Omar Sy', 'Sy, Omar', 'Acting', '1978-01-20', 'Trappes, France'),
         ('Léa Seydoux', 'Seydoux, Léa', 'Acting', '1985-07-01', 'Paris, France'),
         ('Christopher Nolan', 'Nolan, Christopher', 'Directing', '1970-07-30', 'London, UK'),
         ('Denis Villeneuve', 'Villeneuve, Denis', 'Directing', '1967-10-03', 'Bécancour, Canada'),
         ('Hayao Miyazaki', 'Miyazaki, Hayao', 'Directing', '1941-01-05', 'Tokyo, Japon'),
         ('Céline Sciamma', 'Sciamma, Céline', 'Directing', '1978-11-12', 'Pontoise, France'),
         ('Tahar Rahim', 'Rahim, Tahar', 'Acting', '1981-07-04', 'Belfort, France'),
         ('Vincent Cassel', 'Cassel, Vincent', 'Acting', '1966-11-23', 'Paris, France')"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("People: {}", e))?;

    // ========================================================================
    // Tags (5)
    // ========================================================================
    sqlx::query(
        "INSERT INTO tags (name, color) VALUES
         ('Vu', '#4CAF50'),
         ('À voir', '#FF9800'),
         ('Favori', '#E91E63'),
         ('4K', '#9C27B0'),
         ('VOSTFR', '#2196F3')"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Tags: {}", e))?;

    // ========================================================================
    // Movies (15 + 2 exact dupes + 2 probable dupes = 19)
    // ========================================================================
    sqlx::query(
        "INSERT INTO movies (title, original_title, year, runtime, overview, content_rating, tagline, owned, primary_quality_score) VALUES
         ('Inception', 'Inception', 2010, 148, 'Un voleur expérimenté dans l''art de l''extraction de secrets enfouis au plus profond du subconscient.', 'PG-13', 'Votre esprit est la scène du crime', 1, 'A'),
         ('Intouchables', 'Intouchables', 2011, 112, 'L''histoire vraie d''une amitié improbable entre un aristocrate tétraplégique et son aide à domicile.', 'R', NULL, 1, 'B'),
         ('Le Fabuleux Destin d''Amélie Poulain', 'Le Fabuleux Destin d''Amélie Poulain', 2001, 122, 'Amélie, serveuse dans un café de Montmartre, décide de changer la vie des gens autour d''elle.', 'R', 'Elle va changer votre vie', 1, 'B'),
         ('Dune', 'Dune', 2021, 155, 'Paul Atreides, un jeune homme doué au destin extraordinaire, doit se rendre sur la planète la plus dangereuse de l''univers.', 'PG-13', 'Au-delà de la peur, le destin vous attend', 1, 'A'),
         ('Le Voyage de Chihiro', 'Sen to Chihiro no Kamikakushi', 2001, 125, 'Chihiro, une fillette de 10 ans, se retrouve piégée dans un monde étrange peuplé de dieux et de créatures magiques.', 'PG', NULL, 1, 'B'),
         ('La Haine', 'La Haine', 1995, 98, 'Vingt-quatre heures dans la vie de trois jeunes de banlieue après une nuit d''émeutes.', 'R', 'Jusqu''ici tout va bien...', 1, 'C'),
         ('Blade Runner 2049', 'Blade Runner 2049', 2017, 164, 'K, un blade runner, découvre un secret longtemps enfoui qui pourrait plonger ce qu''il reste de la société dans le chaos.', 'R', 'Le futur a un passé', 1, 'A'),
         ('Mon Voisin Totoro', 'Tonari no Totoro', 1988, 86, 'Deux petites filles découvrent l''existence de créatures merveilleuses appelées Totoros.', 'G', NULL, 1, 'B'),
         ('Tenet', 'Tenet', 2020, 150, 'Un agent secret doit manipuler le flux du temps pour empêcher la Troisième Guerre mondiale.', 'PG-13', 'Le temps presse', 1, 'A'),
         ('Portrait de la jeune fille en feu', 'Portrait de la jeune fille en feu', 2019, 122, 'En 1770, une peintre est chargée de réaliser le portrait de mariage d''une jeune femme.', 'R', NULL, 1, 'B'),
         ('Un Prophète', 'Un Prophète', 2009, 155, 'Condamné à six ans de prison, Malik El Djebena ne sait ni lire ni écrire.', 'R', NULL, 1, 'C'),
         ('Princesse Mononoké', 'Mononoke-hime', 1997, 134, 'Au XVe siècle, au Japon, le prince Ashitaka affronte un sanglier possédé par un démon.', 'PG-13', NULL, 1, 'B'),
         ('Interstellar', 'Interstellar', 2014, 169, 'Un groupe d''explorateurs utilise un trou de ver pour franchir les limites de l''espace-temps.', 'PG-13', 'L''humanité est née sur Terre, elle n''est pas destinée à y mourir', 1, 'A'),
         ('Les Trois Mousquetaires: D''Artagnan', 'Les Trois Mousquetaires: D''Artagnan', 2023, 121, 'D''Artagnan quitte sa terre natale pour rejoindre les Mousquetaires du Roi.', 'PG-13', NULL, 1, 'B'),
         ('Alien', 'Alien', 1979, 117, 'L''équipage du vaisseau commercial Nostromo est réveillé pendant son voyage retour vers la Terre.', 'R', 'Dans l''espace, personne ne vous entend crier', 1, 'C'),
         -- Exact duplicates (same title)
         ('Inception', 'Inception', 2010, 148, 'Copie doublon pour test de détection.', 'PG-13', NULL, 1, 'B'),
         ('Inception', 'Inception', 2010, 148, 'Deuxième copie doublon.', 'PG-13', NULL, 1, 'C'),
         -- Probable duplicates (similar titles)
         ('Intouchable', 'Intouchable', 2011, 112, 'Titre similaire pour test doublons probables.', 'R', NULL, 1, 'B'),
         ('Les Intouchables', 'Les Intouchables', 2011, 112, 'Autre variante titre pour test doublons probables.', 'R', NULL, 1, 'C')"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Movies: {}", e))?;

    // ========================================================================
    // Movie ↔ Genre associations
    // ========================================================================
    sqlx::query(
        "INSERT INTO movie_genres (movie_id, genre_id) VALUES
         -- Inception: Action, SF, Thriller
         (1, 1), (1, 4), (1, 5),
         -- Intouchables: Comédie, Drame
         (2, 2), (2, 3),
         -- Amélie: Comédie, Drame
         (3, 2), (3, 3),
         -- Dune: SF, Aventure, Action
         (4, 4), (4, 8), (4, 1),
         -- Chihiro: Animation, Aventure
         (5, 6), (5, 8),
         -- La Haine: Drame, Thriller
         (6, 3), (6, 5),
         -- Blade Runner 2049: SF, Thriller, Drame
         (7, 4), (7, 5), (7, 3),
         -- Totoro: Animation
         (8, 6),
         -- Tenet: Action, SF, Thriller
         (9, 1), (9, 4), (9, 5),
         -- Portrait: Drame
         (10, 3),
         -- Un Prophète: Drame, Thriller
         (11, 3), (11, 5),
         -- Mononoké: Animation, Aventure
         (12, 6), (12, 8),
         -- Interstellar: SF, Drame, Aventure
         (13, 4), (13, 3), (13, 8),
         -- Les Trois Mousquetaires: Action, Aventure
         (14, 1), (14, 8),
         -- Alien: SF, Horreur, Thriller
         (15, 4), (15, 7), (15, 5)"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Movie genres: {}", e))?;

    // ========================================================================
    // Movie ↔ Studio associations
    // ========================================================================
    sqlx::query(
        "INSERT INTO movie_studios (movie_id, studio_id) VALUES
         (1, 1), -- Inception -> Warner Bros
         (2, 3), -- Intouchables -> Paramount (distribution)
         (4, 1), -- Dune -> Warner Bros
         (5, 6), -- Chihiro -> Studio Ghibli
         (7, 1), -- Blade Runner 2049 -> Warner Bros
         (8, 6), -- Totoro -> Studio Ghibli
         (9, 1), -- Tenet -> Warner Bros
         (12, 6), -- Mononoké -> Studio Ghibli
         (13, 3), -- Interstellar -> Paramount
         (14, 3), -- Les Trois Mousquetaires -> Paramount
         (15, 5)  -- Alien -> 20th Century Studios"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Movie studios: {}", e))?;

    // ========================================================================
    // Movie ↔ People associations
    // ========================================================================
    sqlx::query(
        "INSERT INTO movie_people (movie_id, person_id, role, character_name, credit_order) VALUES
         -- Inception: Nolan directs
         (1, 5, 'director', NULL, 1),
         -- Intouchables: Omar Sy acts
         (2, 3, 'actor', 'Driss', 1),
         -- Amélie: Cotillard not in it, but Dujardin acts (demo)
         (3, 1, 'actor', 'Nino Quincampoix', 2),
         -- Dune: Villeneuve directs, Seydoux acts
         (4, 6, 'director', NULL, 1),
         (4, 4, 'actor', 'Lady Jessica', 2),
         -- Chihiro: Miyazaki directs
         (5, 7, 'director', NULL, 1),
         -- La Haine: Cassel acts
         (6, 10, 'actor', 'Vinz', 1),
         -- Blade Runner 2049: Villeneuve directs
         (7, 6, 'director', NULL, 1),
         -- Totoro: Miyazaki directs
         (8, 7, 'director', NULL, 1),
         -- Tenet: Nolan directs
         (9, 5, 'director', NULL, 1),
         -- Portrait: Sciamma directs, Seydoux acts
         (10, 8, 'director', NULL, 1),
         (10, 4, 'actor', 'Héloïse', 1),
         -- Un Prophète: Tahar Rahim acts
         (11, 9, 'actor', 'Malik El Djebena', 1),
         -- Mononoké: Miyazaki directs
         (12, 7, 'director', NULL, 1),
         -- Interstellar: Nolan directs
         (13, 5, 'director', NULL, 1),
         -- Les Trois Mousquetaires: Cassel + Dujardin act
         (14, 10, 'actor', 'Athos', 1),
         (14, 1, 'actor', 'Louis XIII', 3),
         -- Alien: no people linked (test incomplete data)
         -- Duplicates get no people
         (15, 10, 'actor', 'Dallas', 1)"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Movie people: {}", e))?;

    // ========================================================================
    // Movie ↔ Tag associations
    // ========================================================================
    sqlx::query(
        "INSERT INTO movie_tags (movie_id, tag_id) VALUES
         (1, 1), (1, 3), (1, 4),  -- Inception: Vu, Favori, 4K
         (2, 1),                   -- Intouchables: Vu
         (3, 1), (3, 3),           -- Amélie: Vu, Favori
         (4, 1), (4, 4),           -- Dune: Vu, 4K
         (5, 1), (5, 3), (5, 5),   -- Chihiro: Vu, Favori, VOSTFR
         (6, 1),                   -- La Haine: Vu
         (7, 4),                   -- Blade Runner 2049: 4K
         (8, 5),                   -- Totoro: VOSTFR
         (9, 2),                   -- Tenet: À voir
         (10, 2),                  -- Portrait: À voir
         (12, 3), (12, 5),         -- Mononoké: Favori, VOSTFR
         (13, 1), (13, 4),         -- Interstellar: Vu, 4K
         (14, 2),                  -- Les Trois Mousquetaires: À voir
         (15, 1)                   -- Alien: Vu"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Movie tags: {}", e))?;

    // ========================================================================
    // Series (2)
    // ========================================================================
    sqlx::query(
        "INSERT INTO series (title, original_title, overview, first_air_date, last_air_date, status, total_seasons, total_episodes, owned) VALUES
         ('Les Mystères de Lyon', 'Les Mystères de Lyon', 'Un commissaire excentrique résout des affaires impossibles dans le Vieux Lyon.', '2020-09-15', '2023-04-20', 'ended', 3, 24, 1),
         ('Cosmos : Nouvelles Frontières', 'Cosmos: New Frontiers', 'Voyage à travers les confins de l''univers avec les dernières découvertes scientifiques.', '2023-01-10', NULL, 'ongoing', 2, 20, 1)"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Series: {}", e))?;

    // ========================================================================
    // Seasons for "Les Mystères de Lyon" (3 seasons)
    // ========================================================================
    sqlx::query(
        "INSERT INTO seasons (series_id, season_number, title, episode_count, air_date) VALUES
         (1, 1, 'Saison 1 — Les Ombres', 8, '2020-09-15'),
         (1, 2, 'Saison 2 — La Conspiration', 8, '2021-09-20'),
         (1, 3, 'Saison 3 — Le Dernier Secret', 8, '2023-01-10')"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Seasons (Lyon): {}", e))?;

    // ========================================================================
    // Seasons for "Cosmos" (2 seasons)
    // ========================================================================
    sqlx::query(
        "INSERT INTO seasons (series_id, season_number, title, episode_count, air_date) VALUES
         (2, 1, 'Saison 1 — Origines', 10, '2023-01-10'),
         (2, 2, 'Saison 2 — Horizons', 10, '2024-03-05')"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Seasons (Cosmos): {}", e))?;

    // ========================================================================
    // Episodes for "Les Mystères de Lyon" — S1 (season_id=1), S2 (season_id=2), S3 (season_id=3)
    // ========================================================================
    for season_offset in 0..3i64 {
        let season_id = season_offset + 1;
        let series_id = 1i64;
        for ep in 1..=8i64 {
            let has_file = if season_offset < 2 { 1 } else if ep <= 4 { 1 } else { 0 };
            let title = format!("Épisode {} — Mystère #{}", ep, season_offset * 8 + ep);
            sqlx::query(
                "INSERT INTO episodes (series_id, season_id, episode_number, title, runtime, has_file, air_date)
                 VALUES (?, ?, ?, ?, 52, ?, date('2020-09-15', '+' || ? || ' days'))"
            )
            .bind(series_id)
            .bind(season_id)
            .bind(ep)
            .bind(&title)
            .bind(has_file)
            .bind(season_offset * 90 + (ep - 1) * 7)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Episodes (Lyon S{}E{}): {}", season_offset + 1, ep, e))?;
        }
    }

    // ========================================================================
    // Episodes for "Cosmos" — S1 (season_id=4), S2 (season_id=5)
    // ========================================================================
    for season_offset in 0..2i64 {
        let season_id = season_offset + 4;
        let series_id = 2i64;
        for ep in 1..=10i64 {
            let has_file = if season_offset == 0 { 1 } else if ep <= 6 { 1 } else { 0 };
            let title = format!("Chapitre {} — {}", ep, match ep {
                1 => "Le Big Bang",
                2 => "Étoiles et Galaxies",
                3 => "Trous Noirs",
                4 => "La Vie Extraterrestre",
                5 => "Matière Noire",
                6 => "Voyages Interstellaires",
                7 => "Le Multivers",
                8 => "L'Entropie",
                9 => "Intelligence Cosmique",
                10 => "L'Avenir de l'Univers",
                _ => "Inconnu",
            });
            sqlx::query(
                "INSERT INTO episodes (series_id, season_id, episode_number, title, runtime, has_file, air_date)
                 VALUES (?, ?, ?, ?, 45, ?, date('2023-01-10', '+' || ? || ' days'))"
            )
            .bind(series_id)
            .bind(season_id)
            .bind(ep)
            .bind(&title)
            .bind(has_file)
            .bind(season_offset * 120 + (ep - 1) * 7)
            .execute(&mut *tx)
            .await
            .map_err(|e| format!("Episodes (Cosmos S{}E{}): {}", season_offset + 1, ep, e))?;
        }
    }

    // ========================================================================
    // Media Versions + Media Files for ~10 movies
    // ========================================================================
    // (movie_id, label, quality_score, resolution, video_codec, audio_codec, audio_channels, container, file_name, file_size, library_id)
    let movie_versions: Vec<(i64, &str, &str, &str, &str, &str, &str, &str, &str, i64, i64)> = vec![
        (1,  "4K HDR",        "A", "3840x2160", "hevc",  "truehd", "7.1", "mkv", "Inception.2010.4K.HDR.mkv",                    42_000_000_000, 1),
        (1,  "1080p",         "B", "1920x1080", "h264",  "ac3",    "5.1", "mkv", "Inception.2010.1080p.BluRay.mkv",              12_000_000_000, 2),
        (2,  "1080p",         "B", "1920x1080", "h264",  "aac",    "stereo", "mp4", "Intouchables.2011.1080p.mp4",               8_500_000_000, 1),
        (4,  "4K HDR Atmos",  "A", "3840x2160", "hevc",  "truehd", "7.1", "mkv", "Dune.2021.4K.HDR.Atmos.mkv",                  58_000_000_000, 1),
        (5,  "1080p VOSTFR",  "B", "1920x1080", "h264",  "aac",    "stereo", "mkv", "Sen.to.Chihiro.2001.1080p.VOSTFR.mkv",     6_200_000_000, 2),
        (7,  "4K HDR",        "A", "3840x2160", "hevc",  "ac3",    "5.1", "mkv", "Blade.Runner.2049.4K.HDR.mkv",                 48_000_000_000, 1),
        (8,  "1080p VOSTFR",  "B", "1920x1080", "av1",   "aac",    "stereo", "mkv", "Tonari.no.Totoro.1988.1080p.mkv",           4_800_000_000, 2),
        (9,  "4K",            "A", "3840x2160", "av1",   "ac3",    "5.1", "mkv", "Tenet.2020.4K.AV1.mkv",                        35_000_000_000, 1),
        (12, "1080p VOSTFR",  "B", "1920x1080", "h264",  "aac",    "stereo", "mkv", "Mononoke.Hime.1997.1080p.VOSTFR.mkv",       7_100_000_000, 2),
        (13, "4K IMAX",       "A", "3840x2160", "hevc",  "truehd", "7.1", "mkv", "Interstellar.2014.4K.IMAX.mkv",               52_000_000_000, 1),
        (15, "720p",          "C", "1280x720",  "h264",  "ac3",    "stereo", "avi", "Alien.1979.720p.avi",                       2_100_000_000, 2),
    ];

    for (i, (movie_id, label, qs, res, vcodec, acodec, achan, container, fname, fsize, lib_id)) in movie_versions.iter().enumerate() {
        let version_id = (i + 1) as i64;

        sqlx::query(
            "INSERT INTO media_versions (owner_type, owner_id, label, quality_score, resolution, video_codec, audio_codec, audio_channels, container)
             VALUES ('movie', ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(movie_id)
        .bind(label)
        .bind(qs)
        .bind(res)
        .bind(vcodec)
        .bind(acodec)
        .bind(achan)
        .bind(container)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Media version {}: {}", i, e))?;

        sqlx::query(
            "INSERT INTO media_files (media_version_id, library_id, file_path, file_name, file_size, is_available, last_seen)
             VALUES (?, ?, ?, ?, ?, 1, datetime('now'))"
        )
        .bind(version_id)
        .bind(lib_id)
        .bind(format!("Films/{}", fname))
        .bind(fname)
        .bind(fsize)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Media file {}: {}", i, e))?;
    }

    // ========================================================================
    // Media Versions + Files for some episodes
    // ========================================================================
    // Lyon S1 episodes 1-4 have files in library 1
    for ep_id in 1..=4i64 {
        let vid = 11 + ep_id; // version IDs after the 11 movie versions
        sqlx::query(
            "INSERT INTO media_versions (owner_type, owner_id, label, quality_score, resolution, video_codec, audio_codec, audio_channels, container)
             VALUES ('episode', ?, '1080p', 'B', '1920x1080', 'h264', 'aac', 'stereo', 'mkv')"
        )
        .bind(ep_id)
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Episode version {}: {}", ep_id, e))?;

        sqlx::query(
            "INSERT INTO media_files (media_version_id, library_id, file_path, file_name, file_size, is_available, last_seen)
             VALUES (?, 1, ?, ?, 1500000000, 1, datetime('now'))"
        )
        .bind(vid)
        .bind(format!("Series/Les.Mysteres.de.Lyon/S01/S01E{:02}.mkv", ep_id))
        .bind(format!("S01E{:02}.mkv", ep_id))
        .execute(&mut *tx)
        .await
        .map_err(|e| format!("Episode file {}: {}", ep_id, e))?;
    }

    // ========================================================================
    // Collections (2)
    // ========================================================================
    sqlx::query(
        "INSERT INTO collections (name, description) VALUES
         ('Saga Spatiale', 'Les meilleurs films de science-fiction de la collection'),
         ('Films du dimanche', 'Films légers et agréables pour un dimanche pluvieux')"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Collections: {}", e))?;

    // Collection items
    sqlx::query(
        "INSERT INTO collection_items (collection_id, movie_id, position) VALUES
         -- Saga Spatiale: Dune, Interstellar, Blade Runner 2049
         (1, 4, 1),
         (1, 13, 2),
         (1, 7, 3),
         -- Films du dimanche: Intouchables, Amélie, Totoro, Les Trois Mousquetaires
         (2, 2, 1),
         (2, 3, 2),
         (2, 8, 3),
         (2, 14, 4)"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Collection items: {}", e))?;

    // ========================================================================
    // Rules (3) — condition_json and action_json as JSON strings
    // ========================================================================
    sqlx::query(r#"
        INSERT INTO rules (name, enabled, priority, condition_json, action_json) VALUES
        ('Auto 4K tag',
         1, 10,
         '{"field":"resolution","operator":"contains","value":"4K"}',
         '{"action_type":"add_tag","value":"4K"}'),
        ('Classer Ghibli',
         1, 20,
         '{"field":"studio","operator":"equals","value":"Studio Ghibli"}',
         '{"action_type":"add_tag","value":"Favori"}'),
        ('VOSTFR auto',
         1, 30,
         '{"field":"audio","operator":"contains","value":"Japanese"}',
         '{"action_type":"add_tag","value":"VOSTFR"}')
    "#)
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Rules: {}", e))?;

    // ========================================================================
    // Inbox Items (4)
    // ========================================================================
    sqlx::query(
        "INSERT INTO inbox_items (category, status, file_path, parsed_title, parsed_year, entity_type) VALUES
         ('unrecognized', 'pending', 'D:\\Media\\Films\\Film.Inconnu.2023.mkv', 'Film Inconnu', 2023, NULL),
         ('conflict', 'pending', 'D:\\Media\\Films\\Inception.2010.REPACK.mkv', 'Inception', 2010, 'movie'),
         ('low_confidence', 'pending', 'D:\\Media\\Films\\Le.Grand.Bleu.1988.mkv', 'Le Grand Bleu', 1988, 'movie'),
         ('placeholder', 'pending', NULL, 'Avatar 3', 2025, 'movie')"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Inbox items: {}", e))?;

    // ========================================================================
    // Change Log entries (audit trail)
    // ========================================================================
    sqlx::query(
        "INSERT INTO change_log (entity_type, entity_id, field, old_value, new_value, source) VALUES
         ('movie', 1, 'primary_quality_score', NULL, 'A', 'scan'),
         ('movie', 1, 'title', 'inception', 'Inception', 'tmdb'),
         ('movie', 2, 'overview', NULL, 'L''histoire vraie d''une amitié improbable...', 'tmdb'),
         ('movie', 4, 'primary_quality_score', NULL, 'A', 'scan'),
         ('series', 1, 'status', 'ongoing', 'ended', 'manual'),
         ('movie', 13, 'primary_quality_score', 'B', 'A', 'scan'),
         ('movie', 7, 'year', NULL, '2017', 'tmdb'),
         ('movie', 15, 'content_rating', NULL, 'R', 'tmdb')"
    )
    .execute(&mut *tx)
    .await
    .map_err(|e| format!("Change log: {}", e))?;

    // ========================================================================
    // Commit transaction
    // ========================================================================
    tx.commit().await.map_err(|e| e.to_string())?;

    let summary = "Données de démo insérées : 2 libraries, 8 genres, 6 studios, 10 personnes, \
5 tags, 19 films (dont 4 doublons), 2 séries (44 épisodes), 11 versions média, \
2 collections, 3 règles, 4 éléments inbox, 8 entrées changelog.";

    log::info!("{}", summary);
    Ok(summary.to_string())
}
