import 'reflect-metadata';
import { injectable, Container, unmanaged } from 'inversify';
import * as React from 'react';
import { useState } from 'react';
import * as renderer from 'react-test-renderer';

import * as hooksModule from '../src'; // for jest.spyOn
import { useContainer, useInjection, Provider, useOptionalInjection, useNamedInjection } from '../src';

@injectable()
class Foo {
    readonly name = 'foo';
}

@injectable()
class Bar {
    readonly name = 'bar';
}

@injectable()
class Baz {
    readonly name: string;

    constructor(@unmanaged() tag: string) {
        this.name = 'baz-' + tag;
    }
}

const aTag = 'a-tag';
const bTag = 'b-tag';

class OptionalService {
    protected _nominalTypeHack!: never; // sometimes duck-typing is not what we want

    constructor(
        public label: string = ''
    ) {}
}

const RootComponent: React.FC = ({ children }) => {
    const [container] = useState(() => {
        const c = new Container();
        c.bind(Foo).toSelf();
        c.bind(Bar).toSelf();
        c.bind(Baz).toDynamicValue(() => new Baz('a')).whenTargetNamed(aTag);
        c.bind(Baz).toDynamicValue(() => new Baz('b')).whenTargetNamed(bTag);
        // NB! binding `Foo` both to self and via `when...` API is buggy, imho, demo test `...` below
        return c;
    });
    return (
        <Provider container={container}>
            <div>{children}</div>
        </Provider>
    );
};

describe('useContainer hook', () => {
    const useContainerSpy = jest.spyOn(hooksModule, 'useContainer');
    const ChildComponent = () => {
        const resolvedContainer = useContainer();
        return <div>{resolvedContainer.constructor.name}</div>;
    };

    afterEach(() => {
        useContainerSpy.mockClear();
    });

    test('uses container from context', () => {
        const container = new Container();

        const tree: any = renderer.create(
            <Provider container={container}>
                <ChildComponent />
            </Provider>
        ).toJSON();

        expect(useContainerSpy).toHaveBeenCalledTimes(1);
        expect(useContainerSpy).lastReturnedWith(container);
        expect(tree.type).toBe('div');
        expect(tree.children[0]).toEqual('Container');
    });

    test('throws when no context found (missing Provider)', () => {
        expect(() => {
            renderer.create(
                <ChildComponent />
            )
        }).toThrowError('Cannot find Inversify container on React Context. `Provider` component is missing in component tree.');
        expect(useContainerSpy).toHaveBeenCalledTimes(1);
        expect(useContainerSpy).toHaveReturnedTimes(0);
    });
});

describe('useInjection hook', () => {
    test('resolve using service identifier (newable)', () => {
        const ChildComponent = () => {
            const foo = useInjection(Foo);
            return <div>{foo.name}</div>;
        };

        const tree: any = renderer.create(
            <RootComponent>
                <ChildComponent />
            </RootComponent>
        ).toJSON();

        expect(tree.type).toBe('div');
        expect(tree.children[0].type).toBe('div');
        expect(tree.children[0].children).toEqual(['foo']);
    });

    test('resolve using service identifier (string)', () => {
        const container = new Container();
        container.bind('FooFoo').to(Foo);

        const ChildComponent = () => {
            const foo = useInjection<Foo>('FooFoo');
            return <div>{foo.name}</div>;
        };

        const tree: any = renderer.create(
            <Provider container={container}>
                <ChildComponent />
            </Provider>
        ).toJSON();

        expect(tree.type).toBe('div');
        expect(tree.children).toEqual(['foo']);
    });

    test('resolve using service identifier (symbol)', () => {
        const identifier = Symbol();

        const container = new Container();
        container.bind(identifier).to(Foo);

        const ChildComponent = () => {
            const foo = useInjection<Foo>(identifier);
            return <div>{foo.name}</div>;
        };

        const tree: any = renderer.create(
            <Provider container={container}>
                <ChildComponent />
            </Provider>
        ).toJSON();

        expect(tree.type).toBe('div');
        expect(tree.children).toEqual(['foo']);
    });
});

describe('useOptionalInjection hook', () => {
    const useOptionalInjectionSpy = jest.spyOn(hooksModule, 'useOptionalInjection');

    afterEach(() => {
        useOptionalInjectionSpy.mockClear();
    });

    test('returns undefined for missing injection/binding', () => {
        const ChildComponent = () => {
            const optionalThing = useOptionalInjection(OptionalService);
            return (
                <>
                    {optionalThing === undefined ? 'missing' : optionalThing}
                </>
            );
        };

        const tree: any = renderer.create(
            <RootComponent>
                <ChildComponent />
            </RootComponent>
        ).toJSON();

        expect(useOptionalInjectionSpy).toHaveBeenCalledTimes(1);
        expect(useOptionalInjectionSpy).toHaveReturnedWith(undefined);
        expect(tree.children).toEqual(['missing']);
    });

    test('resolves using fallback to default value', () => {
        const defaultThing = new OptionalService('default');
        const ChildComponent = () => {
            const defaultFromOptional = useOptionalInjection(OptionalService, () => defaultThing);
            return (
                <>
                    {defaultFromOptional.label}
                </>
            );
        };

        const tree: any = renderer.create(
            <RootComponent>
                <ChildComponent />
            </RootComponent>
        ).toJSON();

        expect(useOptionalInjectionSpy).toHaveBeenCalledTimes(1);
        expect(useOptionalInjectionSpy).toHaveReturnedWith(defaultThing);
        expect(tree.children).toEqual(['default']);
    });

    test('resolves if injection/binding exists', () => {
        const ChildComponent = () => {
            const foo = useOptionalInjection(Foo);
            return (
                <>
                    {foo !== undefined ? foo.name : 'Foo is missing'}
                </>
            );
        };

        const tree: any = renderer.create(
            <RootComponent>
                <ChildComponent />
            </RootComponent>
        ).toJSON();

        expect(useOptionalInjectionSpy).toHaveBeenCalledTimes(1);
        expect(tree.children).toEqual(['foo']);
    });
});

describe('useNamedInjection hook', () => {
    const useNamedInjectionSpy = jest.spyOn(hooksModule, 'useNamedInjection');

    afterEach(() => {
        useNamedInjectionSpy.mockClear();
    });

    test('resolves named injections', () => {
        const ChildComponent = () => {
            const a = useNamedInjection(Baz, aTag);
            const b = useNamedInjection(Baz, bTag);
            return (
                <>
                    {`${a.name} | ${b.name}`}
                </>
            );
        };

        const tree: any = renderer.create(
            <RootComponent>
                <ChildComponent />
            </RootComponent>
        ).toJSON();

        expect(useNamedInjection).toHaveBeenCalledTimes(2);
        expect(tree.children).toEqual(['baz-a | baz-b']);
    });
});
