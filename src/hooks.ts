import { interfaces } from 'inversify';
import { useContext, useRef } from 'react';
import { InversifyReactContext } from './internal/utils';

// TODO:#review: more simple exports code-style, uh?
//  export together with declaration: shorter and visually kinda like accessors (immediately declared)

type LazyRefResult<T> =
	| { resolved: false }
	| { resolved: true, value: T };
const emptyLazyRefResult = { resolved: false } as const;
/**
 * @see https://reactjs.org/docs/hooks-faq.html#how-to-create-expensive-objects-lazily
 *
 * motivation:
 * 1) useMemo won't work: it does not guarantee same instance
 * @see https://reactjs.org/docs/hooks-reference.html#usememo
 * 2) should be more optimal to use over lazy `useState(() => container.get(...))`
 * because `useState` hook is related to re-rendering (which we don't need anyway)
 *
 * implementation details:
 * using explicit `LazyRefResult` instead of `null` or `undefined`
 * to guarantee single call of lazy value factory
 * and for explicit typings
 */
function useLazyRef<T>(resolveValue: () => T): T {
	const serviceRef = useRef<LazyRefResult<T>>(emptyLazyRefResult);
	if (!serviceRef.current.resolved) {
		serviceRef.current = {
			resolved: true,
			value: resolveValue()
		}
	}
	return serviceRef.current.value;
}

export function useContainer(): interfaces.Container {
	const container = useContext(InversifyReactContext);
	if (!container) {
		throw new Error('Cannot find Inversify container on React Context. `Provider` component is missing in component tree.');
	}
	return container;
}

/**
 * Hooks you to container to resolve a ref out of it (only once, so React component would work with the same service instance in each render).
 *
 * TODO:#review: naming? useFromContainer?
 *  or make overload useContainer(resolveFunction) (to minimize public API – amount of different hooks)?
 */
export function useResolved<T>(resolve: (container: interfaces.Container) => T): T {
	const container = useContainer();
	return useLazyRef(() => resolve(container));
}

/**
 * Resolves a service by id (once).
 */
export function useInjection<T>(serviceId: interfaces.ServiceIdentifier<T>): T {
	return useResolved(
		container => container.get<T>(serviceId)
	);
}

// overload with default value resolver;
// no restrictions on default `D` (e.g. `D extends T`) - freedom and responsibility of "user-land code"
export function useOptionalInjection<T, D>(
	serviceId: interfaces.ServiceIdentifier<T>,
	// motivation:
	// to guarantee that "choosing the value" process happens exactly once and
	// to save users from potential bugs with naive `useOptionalInjection(...) ?? or || myDefault`;
	// this callback will be executed only if binding is not found on container
	resolveDefault: () => D
): T | D;
// overload without default value resolver
export function useOptionalInjection<T>(
	serviceId: interfaces.ServiceIdentifier<T>
): T | undefined;
export function useOptionalInjection<T, D>(
	serviceId: interfaces.ServiceIdentifier<T>,
	resolveDefault: () => D | undefined = () => undefined
): T | D | undefined {
	return useResolved(
		container => container.isBound(serviceId)
			? container.get(serviceId)
			: resolveDefault()
	);
}

type InversifyTagKey = string | number | symbol;

export function useNamedInjection<T>(serviceId: interfaces.ServiceIdentifier<T>, named: InversifyTagKey): T {
	return useResolved(
		container => container.getNamed(serviceId, named)
	);
}

export function useTaggedInjection<T>(serviceId: interfaces.ServiceIdentifier<T>, key: InversifyTagKey, value: unknown): T {
	return useResolved(
		container => container.getTagged(serviceId, key, value)
	);
}

export function useAllInjections<T>(serviceId: interfaces.ServiceIdentifier<T>): readonly T[] {
	return useResolved(
		container => container.getAll(serviceId)
	);
}

// TODO:#review: getAllNamed and getAllTagged are still missing in interface :(
//  > TS2339: Property 'getAllNamed' does not exist on type 'Container'.
//  https://github.com/inversify/InversifyJS/pull/989
//  TBA
// export function useAllNamed<T>(serviceId: interfaces.ServiceIdentifier<T>, named: InversifyTagKey): readonly T[] {
// 	return useResolved(
// 		container => container.getAllNamed(serviceId, named)
// 	);
// }
//
// export function useAllTagged<T>(serviceId: interfaces.ServiceIdentifier<T>, key: InversifyTagKey, value: unknown): readonly T[] {
// 	return useResolved(
// 		container => container.getAllTagged(serviceId, key, value)
// 	);
// }
