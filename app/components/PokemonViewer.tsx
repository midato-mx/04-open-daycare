"use client";

import { useEffect, useState } from "react";

type Pokemon = {
  id: number;
  name: string;
  height: number;
  weight: number;
  sprites: {
    other?: {
      ["official-artwork"]?: {
        front_default: string | null;
      };
    };
    front_default: string | null;
  };
  types: Array<{
    type: {
      name: string;
    };
  }>;
};

const POKE_API_URL = "https://pokeapi.co/api/v2/pokemon";

function formatPokemonName(name: string) {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function PokemonViewer() {
  const [pokemonId, setPokemonId] = useState(1);
  const [pokemon, setPokemon] = useState<Pokemon | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadPokemon() {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`${POKE_API_URL}/${pokemonId}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error("No se pudo obtener el Pokémon.");
        }

        const data: Pokemon = await response.json();
        if (controller.signal.aborted) {
          return;
        }

        setPokemon(data);
      } catch {
        if (controller.signal.aborted) {
          return;
        }

        setPokemon(null);
        setError("No pudimos cargar el Pokémon. Intenta de nuevo.");
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    void loadPokemon();

    return () => controller.abort();
  }, [pokemonId]);

  const imageUrl =
    pokemon?.sprites.other?.["official-artwork"]?.front_default ??
    pokemon?.sprites.front_default;

  return (
    <section
      aria-labelledby="pokemon-viewer-title"
      className="mb-6 rounded-[18px] border border-[#ECE0D0] bg-[#FFFDF9] p-5 shadow-[0_4px_14px_-10px_rgba(120,90,60,0.4)]"
    >
      <div className="mb-4">
        <p className="mb-1 text-[12.5px] font-extrabold tracking-[0.8px] text-[#D9583C]">
          POKÉMON DEL MOMENTO
        </p>
        <h2
          id="pokemon-viewer-title"
          className="m-0 font-display text-[22px] font-semibold text-[#3F362E]"
        >
          Descubre un Pokémon
        </h2>
      </div>

      <div
        aria-live="polite"
        className="flex min-h-[230px] flex-col items-center justify-center rounded-[14px] bg-[#FBE3D8] px-4 py-5 text-center"
      >
        {isLoading ? (
          <p className="text-[14px] font-semibold text-[#8A7C6D]">
            Cargando Pokémon…
          </p>
        ) : error ? (
          <p role="alert" className="text-[14px] font-semibold text-[#B8432F]">
            {error}
          </p>
        ) : pokemon ? (
          <>
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={`Ilustración de ${formatPokemonName(pokemon.name)}`}
                className="h-36 w-36 object-contain"
              />
            ) : null}
            <p className="m-0 text-[12px] font-extrabold tracking-[0.8px] text-[#8A7C6D]">
              #{String(pokemon.id).padStart(3, "0")}
            </p>
            <h3 className="m-0 font-display text-[27px] font-semibold text-[#3F362E]">
              {formatPokemonName(pokemon.name)}
            </h3>
            <p className="mt-1 mb-0 text-[13px] text-[#94887B]">
              Tipo:{" "}
              {pokemon.types
                .map(({ type }) => formatPokemonName(type.name))
                .join(" · ")}
            </p>
          </>
        ) : null}
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="button"
          onClick={() =>
            setPokemonId((currentId) => Math.max(1, currentId - 1))
          }
          disabled={pokemonId === 1 || isLoading}
          className="flex-1 rounded-[12px] border border-[#E7DAC8] bg-white px-4 py-3 text-[14px] font-extrabold text-[#8A7C6D] transition hover:bg-[#FFF4F0] disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={() => setPokemonId((currentId) => currentId + 1)}
          disabled={isLoading}
          className="flex-1 rounded-[12px] bg-[#E0654A] px-4 py-3 text-[14px] font-extrabold text-white transition hover:bg-[#D9583C] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Siguiente →
        </button>
      </div>
    </section>
  );
}
